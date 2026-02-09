import { faGoogle, faApple } from "@fortawesome/free-brands-svg-icons";
import { faEnvelope } from "@fortawesome/pro-solid-svg-icons";

export const providerList = {
  "google-oauth2": {
    icon: faGoogle,
    name: "Google SSO Login",
    manageLink: "https://myaccount.google.com",
  },
  email: {
    icon: faEnvelope,
    name: "email",
  },
  apple: {
    icon: faApple,
    name: "Apple SSO Login",
    manageLink: "https://appleid.apple.com/",
  },
};
