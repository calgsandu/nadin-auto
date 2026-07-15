import assert from "node:assert/strict";
import { getEFacturaConfig } from "@/lib/e-factura/config";

assert.equal(getEFacturaConfig({}), null);

assert.throws(
  () => getEFacturaConfig({ EFACTURA_API_USERNAME: "api-user" }),
  /EFACTURA_WSDL_URL.*EFACTURA_ENDPOINT_URL.*EFACTURA_API_PASSWORD/,
);

assert.deepEqual(
  getEFacturaConfig({
    EFACTURA_WSDL_URL: " https://api-test.fisc.md/Service.svc?wsdl ",
    EFACTURA_ENDPOINT_URL: " https://api-test.fisc.md/Service.svc ",
    EFACTURA_API_USERNAME: " api-user ",
    EFACTURA_API_PASSWORD: " secret-with-spaces ",
  }),
  {
    wsdlUrl: "https://api-test.fisc.md/Service.svc?wsdl",
    endpointUrl: "https://api-test.fisc.md/Service.svc",
    username: "api-user",
    password: " secret-with-spaces ",
  },
);

console.log("e-Factura config tests passed");
