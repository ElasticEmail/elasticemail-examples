package main

import (
	"context"
	"fmt"
	"net/http"

	ElasticEmail "github.com/elasticemail/elasticemail-go/v4"
	"github.com/elasticemail/elasticemail-examples/go/internal/ee"
)

// Templates are referenced by name. Create it on first run.
func ensureTemplate(client *ElasticEmail.APIClient, ctx context.Context, name string) {
	_, resp, err := client.TemplatesAPI.TemplatesByNameGet(ctx, name).Execute()
	if err == nil {
		fmt.Printf("Template %q already exists.\n", name)
		return
	}
	if ee.StatusCode(resp) != http.StatusNotFound {
		ee.Fail("get template", resp, err)
	}

	html := ElasticEmail.NewBodyPart(ElasticEmail.BODYCONTENTTYPE_HTML)
	html.SetContent("<h1>Welcome, {firstname}!</h1><p>Thanks for joining {company}.</p>")

	payload := ElasticEmail.NewTemplatePayload(name)
	payload.SetSubject("Welcome, {firstname}!")
	payload.SetBody([]ElasticEmail.BodyPart{*html})
	payload.SetTemplateScope(ElasticEmail.TEMPLATESCOPE_PERSONAL)

	_, resp, err = client.TemplatesAPI.TemplatesPost(ctx).TemplatePayload(*payload).Execute()
	if err != nil {
		ee.Fail("create template", resp, err)
	}
	fmt.Printf("Template %q created.\n", name)
}

func main() {
	client, ctx := ee.NewClient()
	templateName := ee.Env("ELASTICEMAIL_TEMPLATE_NAME", "welcome-example")

	ensureTemplate(client, ctx, templateName)

	// Merge values replace {placeholders} in the template subject and body.
	content := ElasticEmail.NewEmailContent(ee.From())
	content.SetTemplateName(templateName)
	content.SetMerge(map[string]string{"firstname": "Ann", "company": "Acme"})

	recipients := ElasticEmail.NewTransactionalRecipient([]string{ee.To()})
	data := ElasticEmail.NewEmailTransactionalMessageData(*recipients, *content)

	result, resp, err := client.EmailsAPI.EmailsTransactionalPost(ctx).EmailTransactionalMessageData(*data).Execute()
	if err != nil {
		ee.Fail("send template email", resp, err)
	}

	fmt.Println("Template email sent successfully!")
	fmt.Println("Transaction ID:", result.GetTransactionID())
	fmt.Println("Message ID:", result.GetMessageID())
}
