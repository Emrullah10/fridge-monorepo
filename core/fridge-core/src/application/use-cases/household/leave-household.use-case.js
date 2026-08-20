import { OwnerCannotLeaveError } from '../../../domain/errors/index.js';

// Kullanıcı kararı: sahip (owner) doğrudan ayrılamaz — önce sahipliği
// devretmeli ya da alanı silmeli (delete-household.use-case.js). Bu,
// household.created_by'sız bir alan kalmasını (FK RESTRICT ihlali) baştan
// engelliyor. Üye/admin serbestçe ayrılabilir.
const makeLeaveHousehold = ({ householdRepo, householdMemberRepo }) => {
  return async ({ householdId, userId }) => {
    const household = await householdRepo.findById(householdId);
    if (household?.createdBy === userId) {
      throw new OwnerCannotLeaveError();
    }
    await householdMemberRepo.removeMember({ householdId, userId });
  };
};

export { makeLeaveHousehold };
