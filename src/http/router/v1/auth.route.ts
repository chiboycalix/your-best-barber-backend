import { Router } from 'express';
import { CreateUserValidator, LoginValidator, VerifyOtpValidator, verifyUserEmailValidator } from '../../../validators/auth-validator';
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

route.post('/verify-otp', validate(VerifyOtpValidator), (req, res, next) => {
  authController.verifyOtp(req, res, next);
});

route.post('/login-email', validate(LoginValidator), (req, res, next) => {
  authController.login(req, res, next);
});

route.post('/login-phone', validate(LoginValidator), (req, res, next) => {
  authController.login(req, res, next);
});
export default route;