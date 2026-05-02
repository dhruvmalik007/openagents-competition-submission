const transportModule = await import('@ledgerhq/hw-transport-node-hid');
const ethModule = await import('@ledgerhq/hw-app-eth');

const TransportNodeHid = (transportModule.default ?? transportModule) as any;
const Eth = (ethModule.default ?? ethModule) as any;

const transport = await TransportNodeHid.create();

try {
  const eth = new Eth(transport);
  const result = await eth.getAddress("m/44'/60'/0'/0/0", false, true);
  console.log(JSON.stringify(result, null, 2));
} finally {
  await transport.close?.();
}
