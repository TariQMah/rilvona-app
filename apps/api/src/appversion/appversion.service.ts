import { Injectable } from '@nestjs/common';
import { AppPlatform } from '@prisma/client';
import { AppVersionUpdateInput } from '@hiihive/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { decideUpdate } from './decide';

@Injectable()
export class AppVersionService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.appVersionConfig.findMany({ orderBy: { platform: 'asc' } });
  }

  update(platform: AppPlatform, input: AppVersionUpdateInput) {
    return this.prisma.appVersionConfig.upsert({
      where: { platform },
      create: { platform, ...input },
      update: input,
    });
  }

  async check(platform: AppPlatform, versionCode: number) {
    const config = await this.prisma.appVersionConfig.findUnique({ where: { platform } });
    return decideUpdate(config, versionCode);
  }
}
