import driftProtocol from '../../../data/inventory/protocols/drift-protocol.json' with { type: 'json' };
import foomCash from '../../../data/inventory/protocols/foomcash.json' with { type: 'json' };
import hyperbridge from '../../../data/inventory/protocols/hyperbridge.json' with { type: 'json' };
import iotex from '../../../data/inventory/protocols/iotex.json' with { type: 'json' };
import kelpdao from '../../../data/inventory/protocols/kelpdao.json' with { type: 'json' };
import makina from '../../../data/inventory/protocols/makina.json' with { type: 'json' };
import resolvLabs from '../../../data/inventory/protocols/resolv-labs.json' with { type: 'json' };
import rheaFinance from '../../../data/inventory/protocols/rhea-finance.json' with { type: 'json' };
import saga from '../../../data/inventory/protocols/saga.json' with { type: 'json' };
import solvProtocol from '../../../data/inventory/protocols/solv-protocol.json' with { type: 'json' };
import stepFinance from '../../../data/inventory/protocols/step-finance.json' with { type: 'json' };
import tmxtribe from '../../../data/inventory/protocols/tmxtribe.json' with { type: 'json' };
import truebit from '../../../data/inventory/protocols/truebit.json' with { type: 'json' };
import venusProtocol from '../../../data/inventory/protocols/venus-protocol.json' with { type: 'json' };
import volo from '../../../data/inventory/protocols/volo.json' with { type: 'json' };
import yieldblox from '../../../data/inventory/protocols/yieldblox.json' with { type: 'json' };
import yoProtocol from '../../../data/inventory/protocols/yo-protocol.json' with { type: 'json' };
import zerolend from '../../../data/inventory/protocols/zerolend.json' with { type: 'json' };
import type { ProtocolInventory } from '@aegis-arena/etl';

const bundledInventory: Record<string, ProtocolInventory> = {
  'drift-protocol': driftProtocol as ProtocolInventory,
  foomcash: foomCash as ProtocolInventory,
  hyperbridge: hyperbridge as ProtocolInventory,
  iotex: iotex as ProtocolInventory,
  kelpdao: kelpdao as ProtocolInventory,
  makina: makina as ProtocolInventory,
  'resolv-labs': resolvLabs as ProtocolInventory,
  'rhea-finance': rheaFinance as ProtocolInventory,
  saga: saga as ProtocolInventory,
  'solv-protocol': solvProtocol as ProtocolInventory,
  'step-finance': stepFinance as ProtocolInventory,
  tmxtribe: tmxtribe as ProtocolInventory,
  truebit: truebit as ProtocolInventory,
  'venus-protocol': venusProtocol as ProtocolInventory,
  volo: volo as ProtocolInventory,
  yieldblox: yieldblox as ProtocolInventory,
  'yo-protocol': yoProtocol as ProtocolInventory,
  zerolend: zerolend as ProtocolInventory
};

export function loadBundledProtocolInventory(slug: string): ProtocolInventory {
  return bundledInventory[slug] ?? {
    protocolSlug: slug,
    protocolName: slug,
    generatedAt: new Date(0).toISOString(),
    contractAddresses: [],
    offchainResources: []
  };
}
