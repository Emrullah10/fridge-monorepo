import { ForbiddenError, NotFoundError, ValidationError } from '@fridge/errors';
import { log } from '@fridge/helper';

const ROLE_RANK = { viewer: 0, member: 1, admin: 2, owner: 3 };

// households.id UUID kolonu — geçersiz formatlı bir id doğrudan SQL'e
// geçerse Postgres "invalid input syntax for type uuid" ile patlar ve bu
// düzgün bir 404 yerine 500 INTERNAL_ERROR'a çevrilirdi (bkz.
// .wolf/buglog.json, 2026-09-06 teşhisi — hiçbir yerde format kontrolü
// yoktu).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const requireHouseholdRole = ({ householdMemberRepo, minRole = 'viewer', paramName = 'householdId' }) => {
  return async (req, res, next) => {
    try {
      const householdId = req.params[paramName];
      if (!UUID_RE.test(householdId)) {
        throw new ValidationError('Invalid household id');
      }

      const membership = await householdMemberRepo.findMembership({
        householdId,
        userId: req.user.id,
      });

      if (!membership) {
        // Kullanıcıya dönen mesaj bilinçli olarak belirsiz kalır ("alan yok"
        // ile "üye değilsin" ayrımı sızdırılmaz) ama sunucu tarafında ayrım
        // kaydedilir — aksi halde teşhis DB kazısı gerektiriyordu (bkz.
        // .wolf/buglog.json, 2026-09-06).
        log.warn('household_access_denied', { householdId, userId: req.user.id });
        throw new NotFoundError('Household not found');
      }

      if (ROLE_RANK[membership.role] < ROLE_RANK[minRole]) {
        throw new ForbiddenError(`Requires role ${minRole} or higher`);
      }

      req.household = { id: householdId, role: membership.role };
      return next();
    } catch (error) {
      return next(error);
    }
  };
};

export { requireHouseholdRole };
