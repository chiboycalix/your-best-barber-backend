import { createHash } from "node:crypto";
import { User } from "../utils";
import EmailService from "./email.service";
import EncryptionService from "./encryption.service";
import TokenService from "./token.service";
import UserService from "./user.service";
import moment from "moment";
import HelperClass from "../utils/helper";

export default class AuthService {
  constructor(
    private readonly encryptionService: EncryptionService,
    private readonly tokenService: TokenService,
    private readonly userService: UserService,
    private readonly emailService: EmailService
  ) {
    console.log({tokenService:this.tokenService, emailService: this.emailService})
  }

  async createUser(
    createBody: User
  ): Promise<{ user: User; OTP_CODE: string }> {
    createBody.password = await this.encryptionService.hashPassword(
      createBody.password
    );
    const OTP_CODE = HelperClass.generateRandomChar(6, 'num');
    const hashedToken = createHash('sha512')
      .update(String(OTP_CODE))
      .digest('hex');

    createBody.emailVerificationToken = hashedToken;
    createBody.emailVerificationTokenExpiry = moment()
      .add('6', 'hours')
      .utc()
      .toDate();

    const user: User = await this.userService.createUser(createBody);
    return { user, OTP_CODE };
  }

  async loginUser(loginPayload: User) {
    const token = await this.tokenService.generateToken(
      loginPayload.id,
      `${loginPayload.firstName} ${loginPayload.lastName}`
    );

    return token;
  }
}