export type EFacturaConfig = {
  wsdlUrl: string;
  endpointUrl: string;
  username: string;
  password: string;
};

const ENV_KEYS = [
  "EFACTURA_WSDL_URL",
  "EFACTURA_ENDPOINT_URL",
  "EFACTURA_API_USERNAME",
  "EFACTURA_API_PASSWORD",
] as const;

type EFacturaEnv = Record<string, string | undefined>;

/** Returns null when integration is intentionally disabled and throws for partial setup. */
export function getEFacturaConfig(env: EFacturaEnv = process.env): EFacturaConfig | null {
  const values = {
    EFACTURA_WSDL_URL: env.EFACTURA_WSDL_URL?.trim(),
    EFACTURA_ENDPOINT_URL: env.EFACTURA_ENDPOINT_URL?.trim(),
    EFACTURA_API_USERNAME: env.EFACTURA_API_USERNAME?.trim(),
    // Do not trim the password: spaces may be intentional characters.
    EFACTURA_API_PASSWORD: env.EFACTURA_API_PASSWORD,
  };

  if (ENV_KEYS.every((key) => !values[key])) return null;

  const missing = ENV_KEYS.filter((key) => !values[key]);
  if (missing.length > 0) {
    throw new Error(`Configurația e-Factura este incompletă. Lipsesc: ${missing.join(", ")}.`);
  }

  return {
    wsdlUrl: values.EFACTURA_WSDL_URL!,
    endpointUrl: values.EFACTURA_ENDPOINT_URL!,
    username: values.EFACTURA_API_USERNAME!,
    password: values.EFACTURA_API_PASSWORD!,
  };
}
