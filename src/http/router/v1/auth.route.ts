import { Router } from 'express';
import { CreateUserValidator, verifyUserEmailValidator } from '../../../validators/auth-validator';
import { authController } from '../../auth/authentication.module';
import validate from '../../middlewares/validate';

const route = Router();

route.post('/create-user', validate(CreateUserValidator), (req, res, next) => {
  authController.create(req, res, next);
});

route.post(
  '/verify-email',
  validate(verifyUserEmailValidator),
  (req, res, next) => {
    authController.verifyEmail(req, res, next);
  }
);

export default route;