import { Request, Response, NextFunction } from "express";
import httpStatus from "http-status";

import AuthService from "../../services/auth.service";
import UserService from "../../services/user.service";
import EncryptionService from "../../services/encryption.service";
import HelperClass from "../../utils/helper";
import { USER_STATUS } from "../../../config/constants";
import AppException from "../../exceptions/AppExceptions";
import config from "../../../config/default";
import EmailService from "../../services/email.service";

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

      req.body.firstName = HelperClass.titleCase(req.body.firstName);
      req.body.lastName = HelperClass.titleCase(req.body.lastName);
      req.body.referralCode = HelperClass.generateRandomChar(6, "upper-num");

      if (req.body.inviteCode) {
        const user = await this.userService.getUserDetail({
          referralCode: req.body.inviteCode,
        });
        if (!user) throw new Error(`Oops!, Invalid invite code`);
      }
      req.body.status = USER_STATUS.PENDING;
      req.body.rssn = `REN-${req.body.votingAddress.state
        .substring(0, 3)
        .toUpperCase()}-${req.body.votingAddress.lgaIndex}-${req.body.firstName
        .substring(0, 1)
        .toUpperCase()}${req.body.lastName
        .substring(0, 1)
        .toUpperCase()}${HelperClass.generateRandomChar(6, "upper-num")}`;
      /** if user does not exist create the user using the user service */
      const { user, OTP_CODE } = await this.authService.createUser(req.body);
      /** Send email verification to user */
      if (config.enviroment === "production") {
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
}
