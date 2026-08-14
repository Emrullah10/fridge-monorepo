import { ValidationError } from '@fridge/errors';

const VALID_RETENTION_DAYS = new Set([90, 365, null]);

const makeUpdateHouseholdSettings = ({ householdRepo }) => {
  return async ({ householdId, receiptImageRetentionDays }) => {
    if (!VALID_RETENTION_DAYS.has(receiptImageRetentionDays)) {
      throw new ValidationError('receiptImageRetentionDays must be 90, 365, or null');
    }

    return householdRepo.updateSettings(householdId, { receiptImageRetentionDays });
  };
};

export { makeUpdateHouseholdSettings };
