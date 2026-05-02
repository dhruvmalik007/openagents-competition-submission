def run(plan, args):
    enclave_name = args.get("scenario_id", "aegis-demo")
    chain_image = args.get("chain_image", "ghcr.io/foundry-rs/foundry:latest")
    coordinator_image = args.get("coordinator_image", "ghcr.io/aegis-arena/coordinator:latest")
    artifact_image = args.get("artifact_image", "ghcr.io/aegis-arena/artifact-sink:latest")

    chain = plan.add_service(
        name = "chain",
        config = ServiceConfig(
            image = chain_image,
            entrypoint = ["anvil", "--host", "0.0.0.0", "--port", "8545"],
            ports = {"rpc": PortSpec(number = 8545)},
        ),
    )

    coordinator = plan.add_service(
        name = "agent-coordinator",
        config = ServiceConfig(
            image = coordinator_image,
            env_vars = {
                "SCENARIO_ID": enclave_name,
                "CHAIN_RPC_URL": "http://chain:8545",
                "OG_NETWORK": args.get("og_network", "0g-galileo-testnet"),
            },
            ports = {"http": PortSpec(number = 8080)},
        ),
    )

    artifact_sink = plan.add_service(
        name = "artifact-sink",
        config = ServiceConfig(
            image = artifact_image,
            env_vars = {
                "SCENARIO_ID": enclave_name,
                "ARTIFACT_ROOT": "/data/runs",
            },
            ports = {"http": PortSpec(number = 8090)},
        ),
    )

    return {
        "chain_rpc": chain.ip_address + ":8545",
        "coordinator_http": coordinator.ip_address + ":8080",
        "artifact_sink_http": artifact_sink.ip_address + ":8090",
    }
