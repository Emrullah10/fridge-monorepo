import { Router } from 'express';
import { asyncHandler } from '@fridge/helper';
import { requireAuth } from '@fridge/middlewares';

const buildInviteRouter = ({ container }) => {
  const router = Router();
  const { useCases } = container;

  router.post('/:code/accept', requireAuth(), asyncHandler(async (req, res) => {
    const result = await useCases.acceptInvite({ code: req.params.code, userId: req.user.id });
    res.json(result);
  }));

  return router;
};

export { buildInviteRouter };
