import { ForbiddenError, NotFoundError } from '@fridge/errors';

const ROLE_RANK = { viewer: 0, member: 1, admin: 2, owner: 3 };

const requireHouseholdRole = ({ householdMemberRepo, minRole = 'viewer', paramName = 'householdId' }) => {
  return async (req, res, next) => {
    try {
      const householdId = req.params[paramName];
      const membership = await householdMemberRepo.findMembership({
        householdId,
        userId: req.user.id,
      });

      if (!membership) {
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
