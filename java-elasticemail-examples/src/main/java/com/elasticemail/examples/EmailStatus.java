package com.elasticemail.examples;

import com.elasticemail.api.EmailsApi;
import com.elasticemail.client.ApiException;
import com.elasticemail.model.EmailData;
import com.elasticemail.model.EmailJobFailedStatus;
import com.elasticemail.model.EmailJobStatus;

import java.util.List;

public class EmailStatus {
    public static void main(String[] args) {
        // Usage: mvn -q exec:java -Dexec.mainClass=com.elasticemail.examples.EmailStatus -Dexec.args="<transactionId> [messageId]"
        // Both ids are returned by every send call.
        if (args.length < 1 || args[0].isEmpty()) {
            System.err.println("Usage: EmailStatus <transactionId> [messageId]");
            System.exit(1);
        }
        String transactionId = args[0];
        String messageId = args.length > 1 ? args[1] : null;

        EmailsApi emailsApi = new EmailsApi(Ee.client());

        try {
            EmailJobStatus s = emailsApi.emailsByTransactionidStatusGet(
                    transactionId,
                    true,  // showFailed
                    true,  // showSent
                    true,  // showDelivered
                    true,  // showPending
                    true,  // showOpened
                    true,  // showClicked
                    false, // showAbuse
                    false, // showUnsubscribed
                    false, // showErrors
                    false  // showMessageIDs
            );

            System.out.println("=== Transaction status ===");
            System.out.println("Status:      " + s.getStatus());
            System.out.println("Recipients:  " + s.getRecipientsCount());
            System.out.println("Sent:        " + s.getSentCount() + " " + orEmpty(s.getSent()));
            System.out.println("Delivered:   " + s.getDeliveredCount() + " " + orEmpty(s.getDelivered()));
            System.out.println("Pending:     " + s.getPendingCount());
            System.out.println("Opened:      " + s.getOpenedCount());
            System.out.println("Clicked:     " + s.getClickedCount());
            System.out.print("Failed:      " + s.getFailedCount());
            if (s.getFailed() != null) {
                for (EmailJobFailedStatus f : s.getFailed()) {
                    System.out.print(" " + f.getAddress() + " (" + f.getError() + ")");
                }
            }
            System.out.println();
        } catch (ApiException e) {
            Ee.printApiError("fetch status", e);
            System.exit(1);
        }

        if (messageId != null) {
            try {
                EmailData m = emailsApi.emailsByMsgidViewGet(messageId);
                System.out.println("\n=== Message ===");
                System.out.println("From:     " + (m.getPreview() == null ? "" : m.getPreview().getFrom()));
                System.out.println("Subject:  " + (m.getPreview() == null ? "" : m.getPreview().getSubject()));
                if (m.getStatus() != null) {
                    System.out.println("Status:   " + m.getStatus().getStatusName() + " "
                            + (m.getStatus().getDateSent() == null ? "" : m.getStatus().getDateSent()));
                }
                String body = m.getPreview() == null || m.getPreview().getBody() == null ? "" : m.getPreview().getBody();
                System.out.println("Body preview: " + (body.length() > 200 ? body.substring(0, 200) + "..." : body));
            } catch (ApiException e) {
                Ee.printApiError("fetch message", e);
            }
        }
    }

    private static List<String> orEmpty(List<String> list) {
        return list == null ? List.of() : list;
    }
}
