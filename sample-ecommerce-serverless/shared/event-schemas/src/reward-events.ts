/**
 * Rewards Domain Events
 * 
 * These events are published by the Rewards bounded context
 */

export interface RewardIssuedEvent {
  eventType: 'reward.issued';
  eventVersion: '1.0';
  timestamp: string;
  data: {
    rewardId: string;
    customerId: string;
    points: number;
    reason: string;
    expiresAt: string;
  };
  metadata: {
    correlationId: string;
    source: 'rewards-service';
  };
}

export interface RewardRedeemedEvent {
  eventType: 'reward.redeemed';
  eventVersion: '1.0';
  timestamp: string;
  data: {
    redemptionId: string;
    customerId: string;
    rewardId: string;
    pointsRedeemed: number;
    redeemedAt: string;
  };
  metadata: {
    correlationId: string;
    source: 'rewards-service';
  };
}

export interface RewardExpiredEvent {
  eventType: 'reward.expired';
  eventVersion: '1.0';
  timestamp: string;
  data: {
    rewardId: string;
    customerId: string;
    pointsLost: number;
    expiredAt: string;
  };
  metadata: {
    correlationId: string;
    source: 'rewards-service';
  };
}

export type RewardEvent = 
  | RewardIssuedEvent 
  | RewardRedeemedEvent 
  | RewardExpiredEvent;
