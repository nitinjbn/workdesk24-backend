import { HostFeatures } from '../../../models';
import type HostFeature from '../../../models/schemas/HostFeatures';

export class HostRepository {
  async getHostEnabledFeatures(hostId: number): Promise<HostFeature[]> {
    return HostFeatures.findAll({
      attributes: ['featureKey', 'parentFeatureKey'],
      where: {
        hostId,
        isEnabled: 1,
      },
    });
  }
}
