import bcrypt from 'bcryptjs';
import { InvalidCredentialsError } from '../../../domain/errors/index.js';

// Google Play hesap silme politikası: kullanıcı hesabını ve verilerini
// kalıcı olarak silebilmeli. household_member/user_session zaten ON DELETE
// CASCADE olduğu için app_user silinince otomatik gider — ama
// household.created_by üzerinde FK kısıtı var (ON DELETE tanımsız =
// RESTRICT), o yüzden sahip olunan household'lar elden çıkarılmadan
// app_user silinemez. Paylaşılan household'larda veri kaybı olmasın diye
// sahiplik en eski diğer üyeye devredilir; kullanıcı tek üyeyse household
// tamamen silinir (CASCADE storage_location/inventory_item/receipt_scan'i
// de temizler).
const makeDeleteAccount = ({
  datasource,
  userRepo,
  makeUserRepo,
  makeHouseholdRepo,
  makeHouseholdMemberRepo,
  makeHouseholdInviteRepo,
}) => {
  return async ({ userId, password }) => {
    const user = await userRepo.findById(userId);
    if (!user) {
      throw new InvalidCredentialsError();
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new InvalidCredentialsError();
    }

    await datasource.withTransaction(async ({ query }) => {
      const txUserRepo = makeUserRepo({ rawQuery: query });
      const txHouseholdRepo = makeHouseholdRepo({ rawQuery: query });
      const txHouseholdMemberRepo = makeHouseholdMemberRepo({ rawQuery: query });
      const txHouseholdInviteRepo = makeHouseholdInviteRepo({ rawQuery: query });

      const ownedHouseholds = await txHouseholdRepo.findByCreatedBy(userId);

      for (const household of ownedHouseholds) {
        const members = await txHouseholdMemberRepo.listMembers(household.id);
        const nextOwner = members
          .filter((member) => member.userId !== userId)
          .sort((a, b) => new Date(a.joinedAt) - new Date(b.joinedAt))[0];

        if (nextOwner) {
          await txHouseholdRepo.transferOwnership(household.id, nextOwner.userId);
        } else {
          await txHouseholdRepo.deleteById(household.id);
        }
      }

      await txHouseholdInviteRepo.deleteByInvitedBy(userId);
      await txUserRepo.deleteById(userId);
    });
  };
};

export { makeDeleteAccount };
