import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  type CountryCode,
  type Products,
} from "plaid";

// PLAID_ENV switches the whole app between sandbox (public demo) and
// production (real RBC/Wealthsimple) with nothing else changing — see spec §1a.
const PLAID_ENV = (process.env.PLAID_ENV ?? "sandbox") as keyof typeof PlaidEnvironments;

const configuration = new Configuration({
  basePath: PlaidEnvironments[PLAID_ENV],
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
      "PLAID-SECRET": process.env.PLAID_SECRET,
    },
  },
});

export const plaid = new PlaidApi(configuration);

// Products/countries the app links against. Transactions is the core product;
// Canada + US covers RBC and Wealthsimple.
export const PLAID_PRODUCTS = ["transactions"] as Products[];
export const PLAID_COUNTRY_CODES = ["CA", "US"] as CountryCode[];
