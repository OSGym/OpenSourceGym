import assert from "node:assert/strict";
import { describe, it } from "node:test";
import sharp from "sharp";
import { env } from "./env.js";
import {
  buildProfilePhotoUrl,
  processProfilePhoto,
  ProfilePhotoInputError,
} from "./profilePhoto.js";

describe("profile photo processing", () => {
  it("normalizes a valid photo to a metadata-free 1024px JPEG", async () => {
    const input = await sharp({
      create: {
        width: 1200,
        height: 800,
        channels: 3,
        background: "#ff5c1f",
      },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();

    const output = await processProfilePhoto(input, "image/jpeg");
    const metadata = await sharp(output).metadata();

    assert.equal(metadata.format, "jpeg");
    assert.equal(metadata.width, 1024);
    assert.equal(metadata.height, 1024);
    assert.equal(metadata.exif, undefined);
    assert.equal(metadata.xmp, undefined);
  });

  it("rejects a declared MIME type that does not match the file", async () => {
    const png = await sharp({
      create: {
        width: 10,
        height: 10,
        channels: 3,
        background: "#101211",
      },
    })
      .png()
      .toBuffer();

    await assert.rejects(
      () => processProfilePhoto(png, "image/jpeg"),
      ProfilePhotoInputError,
    );
  });

  it("rejects unsupported content types and empty payloads", async () => {
    await assert.rejects(
      () => processProfilePhoto(Buffer.from("not-an-image"), "image/gif"),
      ProfilePhotoInputError,
    );
    await assert.rejects(
      () => processProfilePhoto(Buffer.alloc(0), "image/jpeg"),
      ProfilePhotoInputError,
    );
  });
});

describe("profile photo public URL", () => {
  it("encodes the object key and adds a cache-busting version", () => {
    const previous = env.r2.publicBaseUrl;
    env.r2.publicBaseUrl = "https://media.example.com/";
    try {
      assert.equal(
        buildProfilePhotoUrl(
          "profile-photos/user id/photo.jpg",
          new Date("2026-07-12T00:00:00.000Z"),
        ),
        "https://media.example.com/profile-photos/user%20id/photo.jpg?v=1783814400000",
      );
    } finally {
      env.r2.publicBaseUrl = previous;
    }
  });

  it("returns null without a key or a public base URL", () => {
    const previous = env.r2.publicBaseUrl;
    env.r2.publicBaseUrl = undefined;
    try {
      assert.equal(buildProfilePhotoUrl("key.jpg", new Date()), null);
      assert.equal(buildProfilePhotoUrl(null, new Date()), null);
    } finally {
      env.r2.publicBaseUrl = previous;
    }
  });
});
