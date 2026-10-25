import type { MediaResult } from "@capacitor/camera";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  pickGalleryPhoto,
  pickGalleryVideo,
  recordVideo,
  takePhoto,
} from "./capture";

const cameraStub = vi.hoisted(() => ({
  checkPermissions: vi.fn(),
  requestPermissions: vi.fn(),
  takePhoto: vi.fn(),
  recordVideo: vi.fn(),
  chooseFromGallery: vi.fn(),
}));

vi.mock("@capacitor/camera", () => ({
  Camera: cameraStub,
  MediaTypeSelection: { Photo: 0, Video: 1, All: 2 },
  CameraErrorCode: {
    TakePhotoCancelled: "OS-PLUG-CAMR-0006",
    RecordVideoCancelled: "OS-PLUG-CAMR-0017",
    ChooseMediaCancelled: "OS-PLUG-CAMR-0020",
  },
}));

function mediaResult(overrides: Partial<MediaResult> = {}): MediaResult {
  return {
    type: 0,
    saved: false,
    webPath: "http://localhost/_capacitor_content_/photo.jpg",
    metadata: { format: "jpeg", size: 100 },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  cameraStub.checkPermissions.mockResolvedValue({
    camera: "granted",
    photos: "granted",
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      blob: async () => new Blob(["0123456789"]),
    })) as unknown as typeof fetch,
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("takePhoto", () => {
  it("returns the capture as a validated File", async () => {
    cameraStub.takePhoto.mockResolvedValue(mediaResult());
    const file = await takePhoto();
    expect(file).toBeInstanceOf(File);
    expect(file?.type).toBe("image/jpeg");
    expect(file?.name).toBe("captured-photo.jpeg");
    expect(file?.size).toBe(10);
  });

  it("returns null when the user cancels", async () => {
    cameraStub.takePhoto.mockRejectedValue({
      code: "OS-PLUG-CAMR-0006",
    });
    await expect(takePhoto()).resolves.toBeNull();
  });

  it("throws when camera access is denied", async () => {
    cameraStub.checkPermissions.mockResolvedValue({
      camera: "prompt",
      photos: "granted",
    });
    cameraStub.requestPermissions.mockResolvedValue({
      camera: "denied",
      photos: "granted",
    });
    await expect(takePhoto()).rejects.toThrow(/denied/);
  });

  it("rejects oversize captures before reading bytes", async () => {
    cameraStub.takePhoto.mockResolvedValue(
      mediaResult({ metadata: { format: "jpeg", size: 11 * 1024 * 1024 } }),
    );
    await expect(takePhoto()).rejects.toThrow(/exceeds the 10MB photo cap/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects unsupported formats", async () => {
    cameraStub.takePhoto.mockResolvedValue(
      mediaResult({ metadata: { format: "gif", size: 100 } }),
    );
    await expect(takePhoto()).rejects.toThrow(/not a supported photo/);
  });
});

describe("recordVideo", () => {
  it("returns the recording as a validated File", async () => {
    cameraStub.recordVideo.mockResolvedValue(
      mediaResult({
        type: 1,
        webPath: "http://localhost/_capacitor_content_/clip.mp4",
        metadata: { format: "mp4", size: 100 },
      }),
    );
    const file = await recordVideo();
    expect(file?.type).toBe("video/mp4");
    expect(file?.name).toBe("recorded-clip.mp4");
  });

  it("returns null when the user cancels", async () => {
    cameraStub.recordVideo.mockRejectedValue({
      code: "OS-PLUG-CAMR-0017",
    });
    await expect(recordVideo()).resolves.toBeNull();
  });
});

describe("gallery pickers", () => {
  it("picks a single photo from gallery results", async () => {
    cameraStub.chooseFromGallery.mockResolvedValue({
      results: [mediaResult({ metadata: { format: "png", size: 100 } })],
    });
    const file = await pickGalleryPhoto();
    expect(file?.type).toBe("image/png");
    expect(file?.name).toBe("gallery-photo.png");
  });

  it("returns null when the gallery closes with no pick", async () => {
    cameraStub.chooseFromGallery.mockResolvedValue({ results: [] });
    await expect(pickGalleryVideo()).resolves.toBeNull();
  });

  it("returns null when the gallery is cancelled", async () => {
    cameraStub.chooseFromGallery.mockRejectedValue({
      code: "OS-PLUG-CAMR-0020",
    });
    await expect(pickGalleryVideo()).resolves.toBeNull();
  });
});
