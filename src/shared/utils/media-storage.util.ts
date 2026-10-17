import cloudinary from '../../config/cloudinary';
import { get } from 'https';
import { IncomingMessage } from 'http';
import { createConfiguredError } from './error.util';

export function mediaDownloadError(timeout = false): Error {
  const code = timeout ? 'TASK_ATTACHMENT_DOWNLOAD_TIMEOUT' : 'TASK_ATTACHMENT_DOWNLOAD_FAILED';
  return createConfiguredError(code, timeout ? 'Attachment download timed out' : 'Attachment file is unavailable', timeout ? 504 : 502, code);
}

export async function openMediaDownload(fileUrl: string, folder: string, signal: AbortSignal): Promise<IncomingMessage> {
  let url: URL;
  try {
    url = new URL(fileUrl);
    const cloudName = cloudinary.config().cloud_name;
    const segments = url.pathname.split('/');
    const signed = /^s--[A-Za-z0-9_-]+--$/.test(segments[4] || '');
    const versionIndex = signed ? 5 : 4;
    const asset = segments.slice(versionIndex + 1).join('/');
    if (
      url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com' || url.port ||
      url.username || url.password || (url.search && !/^\?_a=[A-Za-z0-9_-]+$/.test(url.search)) || url.hash || !cloudName ||
      segments[1] !== cloudName || !['image', 'raw'].includes(segments[2]) ||
      !['upload', 'authenticated'].includes(segments[3]) ||
      (segments[3] === 'authenticated' && !signed) ||
      !/^v[1-9]\d*$/.test(segments[versionIndex] || '') ||
      !asset.startsWith(`${folder}/`) ||
      !/^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9]+)?$/.test(asset.slice(folder.length + 1))
    ) throw mediaDownloadError();
    url.search = '';
  } catch {
    throw mediaDownloadError();
  }

  return new Promise<IncomingMessage>((resolve, reject) => {
    let upstream: IncomingMessage | undefined;
    const request = get(url, { signal, headers: { 'Accept-Encoding': 'identity' } }, (response) => {
      upstream = response;
      response.on('error', () => undefined);
      response.once('close', cleanup);
      if (
        response.statusCode !== 200 ||
        (response.headers['content-encoding'] && response.headers['content-encoding'] !== 'identity')
      ) {
        response.destroy();
        reject(mediaDownloadError());
        return;
      }
      resolve(response);
    });
    const deadline = setTimeout(() => request.destroy(mediaDownloadError(true)), 120_000);
    deadline.unref();
    function cleanup(): void {
      clearTimeout(deadline);
    }
    request.setTimeout(15_000, () => request.destroy(mediaDownloadError(true)));
    request.on('error', (error: Error & { statusCode?: number }) => {
      cleanup();
      const safeError = mediaDownloadError(error.statusCode === 504);
      if (upstream) upstream.destroy(safeError);
      reject(safeError);
    });
  });
}

export type MediaResourceType = 'image' | 'video' | 'auto';

export interface MediaUploadResult {
  url: string;
  fileId: string;
  raw: unknown;
}

export interface MediaUploadOptions {
  accessMode?: 'public' | 'authenticated';
}

export interface MediaDeleteOptions {
  resourceType?: 'image' | 'video' | 'raw';
  accessMode?: 'public' | 'authenticated';
}

export interface BatchMediaUploadResult {
  successful: MediaUploadResult[];
  failed: Array<{ error: string }>;
}

export interface MediaDeleteResult {
  fileId: string;
  result: string;
  raw: unknown;
}

export interface BatchMediaDeleteResult {
  successful: MediaDeleteResult[];
  failed: Array<{ fileId: string; error: string }>;
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
  folder: string,
  options: MediaUploadOptions = {}
): Promise<MediaUploadResult> {
  return new Promise<MediaUploadResult>((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: getMediaResourceType(file.mimetype),
        ...(options.accessMode === 'authenticated' ? { type: 'authenticated' } : {}),
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

        const url = options.accessMode === 'authenticated'
          ? cloudinary.url(uploadResult.public_id, {
              resource_type: uploadResult.resource_type,
              type: 'authenticated',
              secure: true,
              sign_url: true,
              version: uploadResult.version,
              ...(uploadResult.resource_type !== 'raw' && uploadResult.format
                ? { format: uploadResult.format }
                : {}),
            })
          : uploadResult.secure_url;

        resolve({
          url,
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

export async function deleteMediaFromStorage(
  publicId: string,
  options: MediaDeleteOptions = {}
): Promise<MediaDeleteResult> {
  return new Promise<MediaDeleteResult>((resolve, reject) => {
    cloudinary.uploader.destroy(
      publicId,
      {
        invalidate: true,
        ...(options.resourceType ? { resource_type: options.resourceType } : {}),
        ...(options.accessMode ? { type: options.accessMode } : {}),
      },
      (error: Error | undefined, deleteResult: any) => {
        if (error) {
          reject(error);
          return;
        }

        if (!deleteResult) {
          reject(new Error('Media deletion failed without valid response'));
          return;
        }

        resolve({
          fileId: publicId,
          result: deleteResult.result,
          raw: deleteResult,
        });
      }
    );
  });
}

export async function deleteManyMediaFromStorage(
  publicIds: string[]
): Promise<BatchMediaDeleteResult> {
  const settledResults = await Promise.allSettled(
    publicIds.map((publicId) => deleteMediaFromStorage(publicId))
  );

  const successful = settledResults
    .filter((result): result is PromiseFulfilledResult<MediaDeleteResult> => result.status === 'fulfilled')
    .map((result) => result.value);

  const failed = settledResults
    .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
    .map((result, index) => ({
      fileId: publicIds[settledResults.indexOf(result as any)],
      error: result.reason?.message || String(result.reason),
    }));

  return {
    successful,
    failed,
  };
}
