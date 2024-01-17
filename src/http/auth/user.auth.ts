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
import User from '../../database/models/user.model';
import TokenMustStillBeValid from "./rule/TokenMustStillBeValid";
import log from "../../logging/logger";
import axios from "axios";

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

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      if (req.body.loginOption === 'email') {
        const emailLoginOption = await this.emailLoginOption(req.body);
        return res.status(httpStatus.ACCEPTED).json(emailLoginOption);
      }
      if (req.body.loginOption === 'phone') {
        const phoneLoginOption = await this.phoneLoginOption(req.body);
        return res.status(httpStatus.ACCEPTED).json(phoneLoginOption);
      }
    } catch (err: unknown) {
      if (err instanceof AppException || err instanceof Error) {
        log.error(err);
        return next(new AppException(err.message, httpStatus.BAD_REQUEST));
      }
    }
  }

  async verifyOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const hashedOtp = await this.encryptionService.hashString(req.body.otp);
      let _user: User = await this.userService.getUserDetail({
        otpLogin: hashedOtp,
      });
      if (!_user)
        return next(
          new AppException('Oops!, invalid otp', httpStatus.BAD_REQUEST)
        );

      _user = await this.userService.updateUserById(_user.id, {
        otpLogin: null,
      });

      const token = await this.authService.loginUser(_user);
      await this.userService.updateUserById(_user.id, {
        pushNotificationId: req.body.pushNotificationId,
      });

      return res.status(httpStatus.OK).json({
        status: 'success',
        user: _user,
        token,
      });
    } catch (err: any) {
      return next(
        new AppException(err.status, err.message || httpStatus.FORBIDDEN)
      );
    }
  }

  private async emailLoginOption(body: {
    email: string;
    password: string;
    pushNotificationId: string;
  }) {
    const _userExists = await User.findOne({
      email: body.email,
    }).select('+password');

    if (
      !_userExists ||
      !(await this.encryptionService.comparePassword(
        _userExists.password,
        body.password
      ))
    )
      throw new Error(`Oops!, invalid email or password`);

    if (_userExists.isEmailVerified !== true)
      throw Error('Oops! email address is not verified');
    const token = await this.authService.loginUser(_userExists);
    await this.userService.updateUserById(_userExists.id, {
      pushNotificationId: body.pushNotificationId,
    });

    return {
      user: _userExists,
      token,
    };
  }

  private async phoneLoginOption(body: { phoneNumber: string }) {
    const phoneNumber = body.phoneNumber.startsWith('+234')
      ? body.phoneNumber
      : `+234${body.phoneNumber.replace(/^0+/, '')}`;
    const _userExists = await this.userService.getUserDetail({
      phoneNumber,
    });
    if (!_userExists)
      throw new Error(`Oops!, this phone number is not tied with any account`);

    const otp = HelperClass.generateRandomChar(6, 'num');
    const hashedOtp = await this.encryptionService.hashString(otp);

    await this.userService.updateUserById(_userExists.id, {
      otpLogin: hashedOtp,
    });

    try {
      if (config.ENVIRONMENT === 'production') {
        const smsSent = await axios({
          method: 'POST',
          url: `${config.sendChamp.baseUrl}/verification/create`,
          headers: {
            'content-type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${config.sendChamp.apiKey}`,
          },
          data: {
            channel: 'sms',
            sender: config.sendChamp.senderId,
            token_type: 'numeric',
            token_length: 6,
            expiration_time: 1,
            customer_mobile_number: body.phoneNumber.startsWith('+234')
              ? body.phoneNumber
              : `+234${body.phoneNumber}`,
            meta_data: {
              first_name: _userExists.firstName,
              last_name: _userExists.lastName,
            },
            token: otp,
          },
        });

        return {
          status: smsSent.data.status,
          message: 'OTP sent successfully',
        };
      } else {
        return {
          message: 'OTP sent successfully',
          status: 'success',
          data: {
            message:
              'For testing purposes, OTP wont be sent to your phone number, below is the OTP for login',
            token: otp,
          },
        };
      }
    } catch (err: any) {
      throw new Error(err.data);
    }
  }
}
