import { Request, Response, NextFunction } from "express";
import httpStatus from "http-status";

import AuthService from "../../services/auth.service";
import UserService from "../../services/user.service";
import EncryptionService from "../../services/encryption.service";
import HelperClass from "../../utils/helper";
import AppException from "../../exceptions/AppExceptions";
import config from "../../../config/default";
import EmailService from "../../services/email.service";
import { USER_STATUS } from "../../../config/constants";
import moment from "moment";
import { User } from "../../utils";
import TokenMustStillBeValid from "./rule/TokenMustStillBeValid";

const emailService = new EmailService();

export default class UserAuth {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
    private readonly encryptionService: EncryptionService
  ) {
    console.log({ encryptionService: this.encryptionService });
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      req.body.phoneNumber = req.body.phoneNumber.startsWith("+234")
        ? req.body.phoneNumber
        : `+234${req.body.phoneNumber.replace(/^0+/, "")}`;

      const emailTaken = await this.userService.getUserDetail({
        email: req.body.email,
      });
      delete req.body.confirmPassword;
      const phoneNumberTaken = await this.userService.getUserDetail({
        phoneNumber: req.body.phoneNumber,
      });
      if (emailTaken) throw new Error(`Oops!, ${emailTaken.email} is taken`);
      if (phoneNumberTaken)
        throw new Error(`Oops!, ${phoneNumberTaken.phoneNumber} is taken`);
      req.body.referralCode = HelperClass.generateRandomChar(6, "upper-num");

      if (req.body.inviteCode) {
        const user = await this.userService.getUserDetail({
          referralCode: req.body.inviteCode,
        });
        if (!user) throw new Error(`Oops!, Invalid invite code`);
      }
      req.body.status = USER_STATUS.PENDING;
      /** if user does not exist create the user using the user service */
      const { user, OTP_CODE } = await this.authService.createUser(req.body);
      /** Send email verification to user */
      if (config.ENVIRONMENT === "production") {
        await emailService._sendUserEmailVerificationEmail(
          `${user.firstName} ${user.lastName}`,
          user.email,
          OTP_CODE
        );
        return res.status(httpStatus.OK).json({
          status: "success",
          message: `We've sent an verification email to your mail`,
          user,
        });
      } else {
        return res.status(httpStatus.OK).json({
          status: "success",
          OTP_CODE,
          user,
        });
      }
    } catch (err: unknown) {
      if (err instanceof AppException || err instanceof Error) {
        return next(new AppException(err.message, httpStatus.BAD_REQUEST));
      }
    }
  }

  async verifyEmail(req: Request, res: Response, next: NextFunction) {
    try {
      /**
       * Check if the hashed token sent to the user has not being tampered with
       * Check if the token is the same with the one stores in the database
       * check if the email has not being verified
       * check if the token has expired
       * set emailVerificationToken and emailVerificationTokenExpiry field to null
       */

      const _hashedEmailToken: string = await this.encryptionService.hashString(
        req.body.otp
      );

      const user = await this.userService.getUserDetail({
        isEmailVerified: false,
        emailVerificationToken: _hashedEmailToken,
      });

      if (!user) return TokenMustStillBeValid(next);
      if (
        user.emailVerificationTokenExpiry <
        moment().utc().startOf('day').toDate()
      )
        throw new Error(`Oops!, your token has expired`);

      const data: Pick<
        User,
        | 'emailVerifiedAt'
        | 'isEmailVerified'
        | 'emailVerificationToken'
        | 'emailVerificationTokenExpiry'
        | 'status'
      > = {
        isEmailVerified: true,
        emailVerifiedAt: moment().utc().toDate(),
        emailVerificationToken: null,
        emailVerificationTokenExpiry: null,
        status: USER_STATUS.CONFIRMED,
      };
      await this.userService.updateUserById(user.id, data);

      return res.status(httpStatus.OK).json({
        status: `success`,
        message: `Your email: ${user.email} has been verified`,
      });
    } catch (err: any) {
      return next(
        new AppException(err.message, err.status || httpStatus.BAD_REQUEST)
      );
    }
  }
}
