import type HostFeatures from '../../../models/schemas/HostFeatures';
import { HostRepository } from '../repositories/host.repository';

const hostRepository = new HostRepository();

export class HostService {
  async getHostEnabledFeatures(hostId: number): Promise<{ enabled: HostFeatures['featureKey'][] }> {
    const features = await hostRepository.getHostEnabledFeatures(hostId);
    const enabledKeys = new Set(features.map(feature => feature.featureKey));

    // Filter out features whose parent feature is not enabled
    return {
      enabled: features
        .filter(feature => feature.parentFeatureKey == null || enabledKeys.has(feature.parentFeatureKey))
        .map(feature => feature.featureKey),
    };
  }
}

export default new HostService();
