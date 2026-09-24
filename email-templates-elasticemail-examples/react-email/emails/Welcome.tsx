import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text } from "react-email";

export interface WelcomeProps {
  name: string;
  actionUrl: string;
}

export default function Welcome({ name, actionUrl }: WelcomeProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Welcome to Acme, {name}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={heading}>Welcome, {name}!</Heading>
          <Text style={text}>
            Thanks for signing up. Your account is ready - confirm your email address to finish setting it up.
          </Text>
          <Section style={{ textAlign: "center", margin: "32px 0" }}>
            <Button href={actionUrl} style={button}>
              Get started
            </Button>
          </Section>
          <Text style={text}>If the button does not work, paste this link into your browser: {actionUrl}</Text>
          <Hr style={{ borderColor: "#e5e7eb", margin: "32px 0" }} />
          <Text style={footer}>You are receiving this email because you created an Acme account.</Text>
        </Container>
      </Body>
    </Html>
  );
}

// Sample props for the preview server (`npm run dev`).
Welcome.PreviewProps = {
  name: "Ann",
  actionUrl: "https://example.com/start",
} satisfies WelcomeProps;

const body = { backgroundColor: "#f4f4f5", fontFamily: "Helvetica, Arial, sans-serif", padding: "24px 0" };
const container = { backgroundColor: "#ffffff", borderRadius: "8px", margin: "0 auto", maxWidth: "560px", padding: "32px" };
const heading = { color: "#111827", fontSize: "24px", margin: "0 0 16px" };
const text = { color: "#374151", fontSize: "16px", lineHeight: "24px" };
const button = {
  backgroundColor: "#2563eb",
  borderRadius: "6px",
  color: "#ffffff",
  fontSize: "16px",
  fontWeight: "bold",
  padding: "12px 24px",
  textDecoration: "none",
};
const footer = { color: "#6b7280", fontSize: "12px", lineHeight: "18px" };
