import { Body, Controller, Get, Param, Post, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { uploadSignSchema } from '@hiihive/contracts';
import { Response } from 'express';
import { z } from 'zod';
import { Public, Verified } from '../common/decorators';
import { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/current-user.decorator';
import { AppError } from '../common/errors';
import { ZodPipe } from '../common/zod.pipe';
import { UploadsService } from './uploads.service';

const bytesSchema = z.object({ dataBase64: z.string().min(1) });

@ApiTags('uploads')
@Controller()
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @ApiBearerAuth()
  @Verified()
  @Post('uploads/sign')
  sign(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(uploadSignSchema)) body: z.infer<typeof uploadSignSchema>,
  ) {
    return this.uploads.sign(user.id, body.mimeType, body.byteSize);
  }

  @ApiBearerAuth()
  @Verified()
  @Post('uploads/:id/bytes')
  bytes(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(bytesSchema)) body: z.infer<typeof bytesSchema>,
  ) {
    return this.uploads.saveLocal(user.id, id, body.dataBase64);
  }

  @ApiBearerAuth()
  @Verified()
  @Post('uploads/:id/complete')
  complete(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.uploads.complete(user.id, id);
  }

  @Public()
  @Get('media/uploads/:userId/:file')
  async media(@Param('userId') userId: string, @Param('file') file: string, @Res() res: Response) {
    if (!/^[0-9a-f-]{36}$/i.test(userId) || !/^[0-9a-f-]{36}$/i.test(file)) {
      throw new AppError(404, 'NOT_FOUND', 'Not found');
    }
    const stream = this.uploads.openLocal(`uploads/${userId}/${file}`);
    stream.on('error', () => {
      if (!res.headersSent) res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found', details: null } });
    });
    stream.pipe(res);
  }
}
