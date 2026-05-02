/**
 * @aegis-arena/rl-policy
 * 
 * Dynamic multi-agent RL policy architectures
 * - GRPO (Group Relative Policy Optimization)
 * - PPO (Proximal Policy Optimization) adapter
 * - Policy checkpointing and variant selection
 */

import { randomUUID } from 'node:crypto';

export type AgentRole = 'attacker' | 'ciso' | 'defender' | 'judge';

export type PolicyCheckpoint = {
  checkpointId: string;
  agentRole: AgentRole;
  model: string;
  createdAt: string;
  parameters: {
    systemPromptVersion: number;
    temperatureScaling: number;
    riskTolerance: number;
    aggressivenessWeight?: number;
  };
  metrics: {
    episodesRun: number;
    averageReward: number;
    winRate: number;
    lastUpdated: string;
  };
};

/**
 * Episode trajectory for training
 * Collected from sim runs for policy optimization
 */
export type Trajectory = {
  episodeId: string;
  runId: string;
  protocolSlug: string;
  agentRole: AgentRole;
  
  steps: Array<{
    stepCount: number;
    observation: Record<string, unknown>;
    action: {
      actionType: string;
      intensity: number;
    };
    reward: number;
    done: boolean;
  }>;
  
  // Aggregate metrics
  totalReward: number;
  episodeLength: number;
  terminatedEarly: boolean;
};

/**
 * GRPO batch for group-relative optimization
 * Compares multiple policy variants
 */
export type GRPOBatch = {
  batchId: string;
  agentRole: AgentRole;
  variantCount: number;
  episodesPerVariant: number;
  
  variants: Array<{
    variantId: string;
    checkpointId: string;
    trajectories: Trajectory[];
    avgReward: number;
    winRate: number;
    rank: number;
  }>;
  
  // Rankings and relative performance
  bestVariantId: string;
  relativePerformance: Record<string, number>; // normalized scores
  
  timestamp: string;
};

/**
 * GRPO (Group Relative Policy Optimization) trainer
 * 
 * Implements group relative policy gradient for multi-agent RL.
 * Evaluates multiple policy variants in parallel and selects the best performers.
 * Uses relative performance metrics to guide policy search.
 */
export class GRPOTrainer {
  private trajectoryBuffer: Trajectory[] = [];
  private readonly maxBufferSize: number = 1000;
  
  constructor(private config: {
    agentRole: AgentRole;
    learningRate?: number;      // Policy gradient step size
    groupSize?: number;          // Number of variants to compare
    episodesPerVariant?: number; // Trajectories collected per variant
    entropyCoefficient?: number; // Exploration bonus
  }) {}

  /**
   * Add trajectory to training buffer
   */
  addTrajectory(trajectory: Trajectory): void {
    this.trajectoryBuffer.push(trajectory);
    if (this.trajectoryBuffer.length > this.maxBufferSize) {
      this.trajectoryBuffer.shift();
    }
  }

  /**
   * Compute group relative policy gradients
   * Compares variants and produces relative performance scores
   */
  computeGroupGradients(batch: GRPOBatch): {
    gradients: Record<string, number[]>;
    relativeScores: Record<string, number>;
  } {
    const groupSize = batch.variants.length;
    if (groupSize < 2) {
      throw new Error('GRPO requires at least 2 variants for comparison');
    }

    // Compute baseline (mean performance)
    const meanReward = batch.variants.reduce((sum, v) => sum + v.avgReward, 0) / groupSize;

    // Compute relative advantage for each variant
    const advantages = batch.variants.map((variant) => ({
      variantId: variant.variantId,
      advantage: variant.avgReward - meanReward
    }));

    // Normalize advantages to [0, 1]
    const maxAdvantage = Math.max(...advantages.map((a) => Math.abs(a.advantage)));
    const normalizedScores: Record<string, number> = {};

    for (const adv of advantages) {
      normalizedScores[adv.variantId] = 0.5 + (adv.advantage / (maxAdvantage + 1e-8)) * 0.5;
    }

    // Compute policy gradients (gradient direction toward high-performing variants)
    const gradients: Record<string, number[]> = {};
    for (const variant of batch.variants) {
      const advantage = normalizedScores[variant.variantId];
      
      // Gradient components: direction & magnitude
      gradients[variant.variantId] = [
        advantage * (this.config.learningRate ?? 0.01),  // Policy update magnitude
        Math.log(Math.max(advantage, 0.01))               // Log probability weighting
      ];
    }

    return { gradients, relativeScores: normalizedScores };
  }

  /**
   * Evaluate a batch of policy variants
   * Computes GRPO metrics for ranking
   */
  evaluateBatch(batch: GRPOBatch): GRPOBatch {
    // Rank variants by average reward
    const ranked = batch.variants.sort((a, b) => b.avgReward - a.avgReward);
    
    ranked.forEach((variant, index) => {
      variant.rank = index + 1;
    });

    // Compute relative performance
    const relativePerf: Record<string, number> = {};
    const topReward = ranked[0].avgReward;

    for (const variant of ranked) {
      const ratio = topReward > 0 ? variant.avgReward / topReward : 0;
      relativePerf[variant.variantId] = ratio;
    }

    return {
      ...batch,
      bestVariantId: ranked[0].variantId,
      relativePerformance: relativePerf
    };
  }

  /**
   * Generate new policy variant through GRPO mutation
   * Samples from the group distribution to create improved variant
   */
  generateVariant(baseCheckpoint: PolicyCheckpoint, batch: GRPOBatch): Partial<PolicyCheckpoint['parameters']> {
    const { gradients, relativeScores } = this.computeGroupGradients(batch);

    // Weighted sampling from top performers
    const topVariants = batch.variants.slice(0, Math.ceil(batch.variants.length / 2));
    const weights = topVariants.map((v) => relativeScores[v.variantId]);
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    
    // Generate mutations based on top performers
    const avgTemperature = topVariants.reduce((sum, v) => sum + (v.avgReward * 0.1), 0) / topVariants.length;
    const avgRiskTolerance = topVariants.reduce((sum, v) => sum + (v.winRate * 0.8), 0) / topVariants.length;

    return {
      temperatureScaling: Math.max(0.1, Math.min(2.0, 1.0 + (Math.random() - 0.5) * avgTemperature)),
      riskTolerance: Math.max(0.0, Math.min(1.0, avgRiskTolerance + (Math.random() - 0.5) * 0.2)),
      aggressivenessWeight: Math.max(0.0, Math.min(1.0, (baseCheckpoint.parameters.aggressivenessWeight ?? 0.5) + (Math.random() - 0.5) * 0.1))
    };
  }

  /**
   * Get current buffer statistics
   */
  getBufferStats(): {
    trajectoryCount: number;
    avgReward: number;
    maxReward: number;
    minReward: number;
  } {
    if (this.trajectoryBuffer.length === 0) {
      return { trajectoryCount: 0, avgReward: 0, maxReward: 0, minReward: 0 };
    }

    const rewards = this.trajectoryBuffer.map((t) => t.totalReward);
    return {
      trajectoryCount: this.trajectoryBuffer.length,
      avgReward: rewards.reduce((a, b) => a + b, 0) / rewards.length,
      maxReward: Math.max(...rewards),
      minReward: Math.min(...rewards)
    };
  }
}

/**
 * PPO (Proximal Policy Optimization) trainer
 * Simpler alternative to GRPO for single-agent policy updates
 */
export class PPOTrainer {
  private trajectoryBuffer: Trajectory[] = [];
  private readonly maxBufferSize: number = 500;

  constructor(private config: {
    agentRole: AgentRole;
    clipRatio?: number;        // PPO clip range (typically 0.2)
    valueCoefficient?: number; // Weight of value loss (typically 0.5)
    entropyCoefficient?: number;
  }) {}

  addTrajectory(trajectory: Trajectory): void {
    this.trajectoryBuffer.push(trajectory);
    if (this.trajectoryBuffer.length > this.maxBufferSize) {
      this.trajectoryBuffer.shift();
    }
  }

  /**
   * Compute PPO loss for a trajectory
   * Standard PPO clipped objective
   */
  computePPOLoss(trajectory: Trajectory, oldLogProb: number): {
    policyLoss: number;
    valueLoss: number;
    entropySurrogate: number;
  } {
    const clipRatio = this.config.clipRatio ?? 0.2;
    const valueCoeff = this.config.valueCoefficient ?? 0.5;
    const entropyCoeff = this.config.entropyCoefficient ?? 0.01;

    // Compute advantages using generalized advantage estimation
    const advantages = this.computeAdvantages(trajectory);
    const returns = this.computeReturns(trajectory);

    // PPO clipped objective
    const newLogProb = Math.log(Math.max(0.01, 0.5)); // Simulated new log probability
    const ratio = Math.exp(newLogProb - oldLogProb);
    const clippedRatio = Math.max(1 - clipRatio, Math.min(1 + clipRatio, ratio));

    // Policy loss (negative for gradient ascent)
    const policyLoss = -Math.min(
      ratio * advantages[0],
      clippedRatio * advantages[0]
    );

    // Value loss (MSE against returns)
    const predictedValue = 0.5; // Simulated predicted value
    const valueLoss = valueCoeff * Math.pow(predictedValue - returns[0], 2);

    // Entropy bonus for exploration
    const entropySurrogate = -entropyCoeff * Math.log(Math.max(0.01, 0.5));

    return { policyLoss, valueLoss, entropySurrogate };
  }

  /**
   * Compute generalized advantage estimation (GAE)
   */
  private computeAdvantages(trajectory: Trajectory): number[] {
    const gaeBuffer: number[] = [];
    let gae = 0;

    for (let i = trajectory.steps.length - 1; i >= 0; i--) {
      const step = trajectory.steps[i];
      const nextValue = i < trajectory.steps.length - 1 ? 0.5 : 0; // Simulated
      const delta = step.reward + 0.99 * nextValue - 0.5;
      gae = delta + 0.95 * 0.99 * gae;
      gaeBuffer.unshift(gae);
    }

    return gaeBuffer;
  }

  /**
   * Compute returns using discount factor
   */
  private computeReturns(trajectory: Trajectory): number[] {
    const returns: number[] = [];
    let runningReturn = 0;

    for (let i = trajectory.steps.length - 1; i >= 0; i--) {
      runningReturn = trajectory.steps[i].reward + 0.99 * runningReturn;
      returns.unshift(runningReturn);
    }

    return returns;
  }
}

/**
 * A3C (Asynchronous Advantage Actor-Critic) style trainer
 * For distributed, asynchronous updates
 */
export class A3CTrainer {
  private gradientBuffer: Array<{
    gradient: number[];
    timestamp: string;
  }> = [];

  constructor(private config: {
    agentRole: AgentRole;
    discountFactor?: number;
    learningRate?: number;
  }) {}

  /**
   * Compute asynchronous advantage actor-critic gradients
   * Optimized for parallel trajectory collection
   */
  computeAsyncGradient(trajectory: Trajectory): number[] {
    const gamma = this.config.discountFactor ?? 0.99;
    
    // Actor gradient: log policy weighted by advantage
    // Critic gradient: value loss
    
    let actorGrad = 0;
    let criticGrad = 0;

    for (const step of trajectory.steps) {
      const advantage = step.reward - 0.5; // Value baseline
      actorGrad += Math.log(Math.max(0.01, 0.5)) * advantage;
      criticGrad += Math.pow(advantage, 2);
    }

    return [
      actorGrad / trajectory.steps.length,
      criticGrad / trajectory.steps.length
    ];
  }

  /**
   * Accumulate gradients for asynchronous updates
   */
  accumulateGradient(trajectory: Trajectory): void {
    const gradient = this.computeAsyncGradient(trajectory);
    this.gradientBuffer.push({
      gradient,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get accumulated gradients and clear buffer
   */
  getAndClearGradients(): number[] {
    if (this.gradientBuffer.length === 0) {
      return [0, 0];
    }

    const avgGradient = [0, 0];
    for (const entry of this.gradientBuffer) {
      avgGradient[0] += entry.gradient[0];
      avgGradient[1] += entry.gradient[1];
    }

    avgGradient[0] /= this.gradientBuffer.length;
    avgGradient[1] /= this.gradientBuffer.length;

    this.gradientBuffer = [];
    return avgGradient;
  }
}

/**
 * Multi-agent RL policy coordinator
 * Manages training for all agent roles simultaneously
 */
export class MultiAgentPolicyCoordinator {
  private trainers: Map<AgentRole, GRPOTrainer> = new Map();
  private checkpoints: Map<AgentRole, PolicyCheckpoint[]> = new Map();

  addTrainer(role: AgentRole, trainer: GRPOTrainer): void {
    this.trainers.set(role, trainer);
  }

  getTrainer(role: AgentRole): GRPOTrainer {
    const trainer = this.trainers.get(role);
    if (!trainer) {
      throw new Error(`No trainer registered for role: ${role}`);
    }
    return trainer;
  }

  saveCheckpoint(checkpoint: PolicyCheckpoint): void {
    const role = checkpoint.agentRole;
    if (!this.checkpoints.has(role)) {
      this.checkpoints.set(role, []);
    }
    this.checkpoints.get(role)!.push(checkpoint);
  }

  getBestCheckpoint(role: AgentRole): PolicyCheckpoint | undefined {
    const checkpoints = this.checkpoints.get(role) ?? [];
    if (checkpoints.length === 0) return undefined;
    return checkpoints.reduce((best, cp) =>
      cp.metrics.averageReward > best.metrics.averageReward ? cp : best
    );
  }

  /**
   * Coordinate training across all agent roles
   * Returns summary of training progress
   */
  coordinateTraining(): Record<
    AgentRole,
    {
      bufferSize: number;
      avgReward: number;
      bestCheckpointId?: string;
    }
  > {
    const summary: Record<
      AgentRole,
      {
        bufferSize: number;
        avgReward: number;
        bestCheckpointId?: string;
      }
    > = {
      attacker: { bufferSize: 0, avgReward: 0 },
      ciso: { bufferSize: 0, avgReward: 0 },
      defender: { bufferSize: 0, avgReward: 0 },
      judge: { bufferSize: 0, avgReward: 0 }
    };

    for (const [role, trainer] of this.trainers.entries()) {
      const stats = trainer.getBufferStats();
      const bestCheckpoint = this.getBestCheckpoint(role);

      summary[role] = {
        bufferSize: stats.trajectoryCount,
        avgReward: stats.avgReward,
        bestCheckpointId: bestCheckpoint?.checkpointId
      };
    }

    return summary;
  }
}

export default GRPOTrainer;
