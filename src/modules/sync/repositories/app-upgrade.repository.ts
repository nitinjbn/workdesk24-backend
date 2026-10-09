import { Op } from 'sequelize';
import { AppRelease, AppUpgradePolicy } from '../../../models';

type DistributionChannel = 'WEBSITE' | 'PLAYSTORE';
type AppPlatform = 'ANDROID';

export interface CheckAppVersionPayload {
  hostId: number;
  userId: number;
  versionCode?: number | null;
  versionName?: string | null;
  platform?: AppPlatform;
}

export interface AppVersionCheckResult {
  isUpdateAvailable: boolean;
  latestVersionName: string | null;
  latestVersionCode: number | null;
  forceUpdate: boolean;
  distributionChannel: DistributionChannel | null;
  updateUrl: string | null;
  apkSha256: string | null;
  releaseNotes: string | null;
  message: string | null;
}

export class AppUpgradeRepository {
  async checkAppVersion(payload: CheckAppVersionPayload): Promise<AppVersionCheckResult> {
    const { hostId, userId } = payload;
    const versionCode =
      Number.isFinite(Number(payload.versionCode)) && Number(payload.versionCode) > 0
        ? Math.floor(Number(payload.versionCode))
        : null;
    const versionName =
      typeof payload.versionName === 'string' && payload.versionName.trim()
        ? payload.versionName.trim()
        : null;
    const platform: AppPlatform = payload.platform || 'ANDROID';
    const now = Math.floor(Date.now() / 1000);

    // Policy resolution priority: USER > HOST > GLOBAL.
    // An update is offered only when an active policy targets this user.
    const policy = await this.findApplicablePolicy(hostId, userId, platform, now);
    const release: InstanceType<typeof AppRelease> | null = policy
      ? (((policy as any).release as InstanceType<typeof AppRelease>) ?? null)
      : null;
    const forceUpdate = policy ? Number((policy as any).forceUpdate) === 1 : false;
    const message = policy ? ((policy as any).message ?? null) : null;

    if (!release) {
      return {
        isUpdateAvailable: false,
        latestVersionName: versionName,
        latestVersionCode: versionCode,
        forceUpdate: false,
        distributionChannel: null,
        updateUrl: null,
        apkSha256: null,
        releaseNotes: null,
        message: null,
      };
    }

    const releaseJson = release.toJSON() as any;
    const isUpdateAvailable = this.isUpdateAvailable(
      releaseJson.versionCode,
      releaseJson.versionName,
      versionCode,
      versionName
    );

    return {
      isUpdateAvailable,
      latestVersionName: releaseJson.versionName,
      latestVersionCode: releaseJson.versionCode,
      forceUpdate: isUpdateAvailable && forceUpdate,
      distributionChannel: releaseJson.distributionChannel,
      updateUrl: releaseJson.downloadUrl,
      apkSha256: releaseJson.apkSha256 ?? null,
      releaseNotes: releaseJson.releaseNotes,
      message,
    };
  }

  private async findApplicablePolicy(
    hostId: number,
    userId: number,
    platform: AppPlatform,
    now: number
  ): Promise<InstanceType<typeof AppUpgradePolicy> | null> {
    const activeWindow = {
      isEnabled: 1,
      effectiveFrom: { [Op.lte]: now },
      [Op.or]: [{ effectiveTill: null }, { effectiveTill: { [Op.gte]: now } }],
    };
    const releaseInclude = [
      {
        model: AppRelease,
        as: 'release',
        required: true,
        where: { isEnabled: 1, platform },
      },
    ];

    const scopeFilters: Record<string, unknown>[] = [
      { scopeType: 'USER', hostId, userId },
      { scopeType: 'HOST', hostId },
      { scopeType: 'GLOBAL' },
    ];

    for (const scopeFilter of scopeFilters) {
      const policy = await AppUpgradePolicy.findOne({
        where: { ...activeWindow, ...scopeFilter } as any,
        include: releaseInclude as any,
        order: [['createdAt', 'DESC']],
      });

      if (policy) {
        return policy;
      }
    }

    return null;
  }

  private isUpdateAvailable(
    latestVersionCode: number,
    latestVersionName: string,
    currentVersionCode: number | null,
    currentVersionName: string | null
  ): boolean {
    if (currentVersionCode !== null) {
      return Number(latestVersionCode) > currentVersionCode;
    }

    if (currentVersionName !== null) {
      return this.compareVersionNames(latestVersionName, currentVersionName) > 0;
    }

    return false;
  }

  private compareVersionNames(latest: string, current: string): number {
    const parse = (value: string): number[] =>
      String(value)
        .split('.')
        .map((part) => {
          const parsed = parseInt(part, 10);
          return Number.isFinite(parsed) ? parsed : 0;
        });

    const latestParts = parse(latest);
    const currentParts = parse(current);
    const length = Math.max(latestParts.length, currentParts.length);

    for (let index = 0; index < length; index += 1) {
      const latestPart = latestParts[index] ?? 0;
      const currentPart = currentParts[index] ?? 0;

      if (latestPart !== currentPart) {
        return latestPart > currentPart ? 1 : -1;
      }
    }

    return 0;
  }
}
