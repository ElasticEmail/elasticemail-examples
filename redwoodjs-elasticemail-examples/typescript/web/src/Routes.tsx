// Pages are imported explicitly instead of relying on Redwood's automatic page imports,
// so the file typechecks without the generated .redwood/types.
import { Router, Route, Set } from "@redwoodjs/router";
import MainLayout from "src/layouts/MainLayout/MainLayout";
import HomePage from "src/pages/HomePage/HomePage";
import SendEmailPage from "src/pages/SendEmailPage/SendEmailPage";
import AttachmentsPage from "src/pages/AttachmentsPage/AttachmentsPage";
import CidAttachmentsPage from "src/pages/CidAttachmentsPage/CidAttachmentsPage";
import TemplatesPage from "src/pages/TemplatesPage/TemplatesPage";
import SchedulingPage from "src/pages/SchedulingPage/SchedulingPage";
import PreventThreadingPage from "src/pages/PreventThreadingPage/PreventThreadingPage";
import ContactsPage from "src/pages/ContactsPage/ContactsPage";
import DomainsPage from "src/pages/DomainsPage/DomainsPage";
import StatisticsPage from "src/pages/StatisticsPage/StatisticsPage";
import DoubleOptinPage from "src/pages/DoubleOptinPage/DoubleOptinPage";
import WebhooksPage from "src/pages/WebhooksPage/WebhooksPage";
import InboundPage from "src/pages/InboundPage/InboundPage";
import NotFoundPage from "src/pages/NotFoundPage/NotFoundPage";

const Routes = () => {
  return (
    <Router>
      <Set wrap={MainLayout}>
        <Route path="/" page={HomePage} name="home" />
        <Route path="/send-email" page={SendEmailPage} name="sendEmail" />
        <Route path="/attachments" page={AttachmentsPage} name="attachments" />
        <Route path="/cid-attachments" page={CidAttachmentsPage} name="cidAttachments" />
        <Route path="/templates" page={TemplatesPage} name="templates" />
        <Route path="/scheduling" page={SchedulingPage} name="scheduling" />
        <Route path="/prevent-threading" page={PreventThreadingPage} name="preventThreading" />
        <Route path="/contacts" page={ContactsPage} name="contacts" />
        <Route path="/domains" page={DomainsPage} name="domains" />
        <Route path="/statistics" page={StatisticsPage} name="statistics" />
        <Route path="/double-optin" page={DoubleOptinPage} name="doubleOptin" />
        <Route path="/webhooks" page={WebhooksPage} name="webhooks" />
        <Route path="/inbound" page={InboundPage} name="inbound" />
      </Set>
      <Route notfound page={NotFoundPage} />
    </Router>
  );
};

export default Routes;
