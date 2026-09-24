import { Injectable } from "@nestjs/common";
import {
  Configuration,
  ContactsApi,
  EmailsApi,
  ListsApi,
} from "@elasticemail/elasticemail-client-ts-axios";

/**
 * The Elastic Email SDK wrapped as a Nest provider. One Configuration and one client per API
 * group are built from the environment when the app starts, then injected where needed.
 */
@Injectable()
export class ElasticEmailService {
  readonly emails: EmailsApi;
  readonly contacts: ContactsApi;
  readonly lists: ListsApi;

  /** Verified sender used for every outgoing message */
  readonly from = process.env.EMAIL_FROM || "Acme <hello@yourdomain.com>";
  /** Team inbox that receives forwarded inbound email */
  readonly contactEmail = process.env.CONTACT_EMAIL || this.from;
  readonly listName = process.env.ELASTICEMAIL_LIST_NAME || "Newsletter";
  readonly publicUrl = process.env.PUBLIC_URL || "http://localhost:3000";
  readonly confirmRedirectUrl = process.env.CONFIRM_REDIRECT_URL;

  constructor() {
    const config = new Configuration({ apiKey: process.env.ELASTICEMAIL_API_KEY });
    this.emails = new EmailsApi(config);
    this.contacts = new ContactsApi(config);
    this.lists = new ListsApi(config);
  }
}
