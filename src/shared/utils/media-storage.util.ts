import cloudinary from '../../config/cloudinary';

export type MediaResourceType = 'image' | 'video' | 'auto';

export interface MediaUploadResult {
  url: string;
  fileId: string;
  raw: unknown;
}

export interface BatchMediaUploadResult {
  successful: MediaUploadResult[];
  failed: Array<{ error: string }>;
}

export function getMediaResourceType(mimeType: string): MediaResourceType {
  if (mimeType.startsWith('image/')) {
    return 'image';
  }

  if (mimeType.startsWith('video/')) {
    return 'video';
  }

  if (mimeType.startsWith('audio/')) {
    return 'video';
  }

  return 'auto';
}

export async function uploadBufferToMediaStorage(
  file: Pick<Express.Multer.File, 'buffer' | 'mimetype'>,
  folder: string
): Promise<MediaUploadResult> {
  return new Promise<MediaUploadResult>((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: getMediaResourceType(file.mimetype),
      },
      (error: Error | undefined, uploadResult: any) => {
        if (error) {
          reject(error);
          return;
        }

        if (!uploadResult?.secure_url || !uploadResult?.public_id) {
          reject(new Error('Media upload failed without valid response'));
          return;
        }

        resolve({
          url: uploadResult.secure_url,
          fileId: uploadResult.public_id,
          raw: uploadResult,
        });
      }
    );

    uploadStream.end(file.buffer);
  });
}

export async function uploadManyBuffersToMediaStorage(
  files: Array<Pick<Express.Multer.File, 'buffer' | 'mimetype'>>,
  folder: string
): Promise<BatchMediaUploadResult> {
  const settledResults = await Promise.allSettled(
    files.map((file) => uploadBufferToMediaStorage(file, folder))
  );

  const successful = settledResults
    .filter((result): result is PromiseFulfilledResult<MediaUploadResult> => result.status === 'fulfilled')
    .map((result) => result.value);

  const failed = settledResults
    .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
    .map((result) => ({
      error: result.reason?.message || String(result.reason),
    }));

  return {
    successful,
    failed,
  };
}
