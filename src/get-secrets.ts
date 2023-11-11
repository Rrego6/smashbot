import { SecretClient } from '@azure/keyvault-secrets';
import { DefaultAzureCredential } from '@azure/identity';

async function getSecrets() {
    const credential = new DefaultAzureCredential();

    const keyVaultName = process.env[""];
    if (!keyVaultName) throw new Error("KEY_VAULT_NAME is empty");
    const url = "https://" + keyVaultName + ".vault.azure.net";

    const client = new SecretClient(url, credential);

    // Create a secret
    // The secret can be a string of any kind. For example,
    // a multiline text block such as an RSA private key with newline characters,
    // or a stringified JSON object, like `JSON.stringify({ mySecret: 'MySecretValue'})`.
    const uniqueString = new Date().getTime();
    const secretName = `secret${uniqueString}`;
    const result = await client.setSecret(secretName, "MySecretValue");
    console.log("result: ", result);

}