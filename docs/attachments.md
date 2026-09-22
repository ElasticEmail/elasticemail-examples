# Attachments and inline images

Attachments are base64 strings inside `Content.Attachments`. There is no upload step and no separate
endpoint - the file travels with the send call.

```typescript
Attachments: [
  {
    BinaryContent: Buffer.from(fileContents).toString("base64"),
    Name: "invoice.pdf",
    ContentType: "application/pdf",
  },
]
```

| Field | Notes |
|---|---|
| `BinaryContent` | Base64 of the raw bytes. Not a data URI - no `data:...;base64,` prefix. |
| `Name` | File name the recipient sees. Also the Content-ID for inline images (below). |
| `ContentType` | MIME type. Clients use it to pick an icon and decide whether to preview. |

Base64 inflates the payload by roughly a third, so a 6 MB file becomes about 8 MB on the wire. Large
files belong behind a link, not in the message.

## Inline images (CID)

Elastic Email derives an attachment's Content-ID from its file name. Reference it as `cid:<Name>` in
the HTML and the image renders in the body rather than appearing as a download.

```typescript
const { data } = await emailsApi.emailsTransactionalPost({
  Recipients: { To: [to] },
  Content: {
    From: from,
    Subject: "Email with Inline Image",
    Body: [
      {
        ContentType: "HTML",
        Content: `<img src="cid:logo.png" alt="Company Logo" width="100" height="100" />
                  <h1>Welcome!</h1>`,
      },
    ],
    Attachments: [
      { BinaryContent: pngBase64, Name: "logo.png", ContentType: "image/png" },
    ],
  },
});
```

The `cid:` value must match `Name` exactly, extension included. `cid:logo` will not resolve
`logo.png`.

### CID versus hosted images

| | Inline (CID) | Hosted URL |
|---|---|---|
| Shows without "load images" | usually yes | no |
| Message size | grows with the image | unchanged |
| Works offline in the client | yes | no |
| Open tracking via image | no | yes, this is how the tracking pixel works |

Use CID for a logo or a signature image. Use hosted URLs for anything large or anything you might
want to swap out after the send.

## Reading attachments off inbound mail

Inbound email arrives with attachments already base64-encoded in `att1_content`, `att2_content` and
so on, paired with `att1_name`. That is the same shape `Attachments` expects, so forwarding is a
straight copy:

```typescript
const attachments = Object.keys(mail)
  .filter((k) => /^att\d+_name$/.test(k))
  .map((k) => ({ Name: mail[k], BinaryContent: mail[k.replace("_name", "_content")] }));
```

See [Inbound email](inbound-email.md) for the rest of the fields.

## Per-language notes

| Language | Encoding the bytes | Field name |
|---|---|---|
| TypeScript / JavaScript | `Buffer.from(bytes).toString("base64")` | `BinaryContent` |
| Python | `base64.b64encode(data).decode()` | `BinaryContent` |
| Ruby | `Base64.strict_encode64(data)` | `binary_content` |
| PHP | `base64_encode($data)` | `binary_content` |
| Go | `base64.StdEncoding.EncodeToString(data)` | `SetBinaryContent` |
| Java | `Base64.getEncoder().encodeToString(bytes)` | `.binaryContent(...)` |
| C# | `Convert.ToBase64String(bytes)` | `binaryContent:` |
| Rust | `base64::engine::general_purpose::STANDARD.encode(bytes)` | `binary_content` |
| Elixir | `Base.encode64(data)` | `"BinaryContent"` |

The examples in every stack (`with-attachments` and `with-cid-attachments`) build the payload
in-memory, so they run without any sample file on disk.
