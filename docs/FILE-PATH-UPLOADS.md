# Server-staged image uploads (no base64 in MCP requests)

The `etsy_image_upload` MCP tool supports `file_path` **only for an image already present on the Etsy MCP server**. It does **not** read the AI client's filesystem: a ChatGPT `/mnt/data` file, a local laptop file, and a remote MCP server file are different locations.

## Enable on a private server

Create an upload-only directory readable by the Etsy MCP service account. For example:

```sh
install -d -m 0700 -o sentinelx -g sentinelx /opt/etsy-api-hub-runtime/uploads
```

Set the service environment variable to that exact absolute directory:

```sh
ETSY_MCP_UPLOAD_DIR=/opt/etsy-api-hub-runtime/uploads
```

Restart the MCP server and refresh the client's tool catalog so `file_path` appears.

Do **not** set the root to `/`, `/opt`, `/home`, or another directory containing credentials or unrelated server data. Leave the variable unset to disable this feature.

## Upload workflow

1. Transfer the JPG/PNG/WebP **to that server directory** through an authorized file-transfer mechanism (for example, SentinelX `sentinel_file_upload_attachment` for a user attachment, or a trusted server-side job).
2. Call the Etsy tool with the server path:

```json
{
  "listing_id": "123456789",
  "file_path": "/opt/etsy-api-hub-runtime/uploads/santa-01.jpg",
  "rank": 1,
  "alt_text": "Personalized Santa video greeting"
}
```

3. Check `etsy_images_list` for successful upload. Remove the staging image when finished.

`file_path`, `file` (base64), and `listing_image_id` are mutually exclusive. Existing base64 uploads and linking an existing image ID continue to work. The typed image operation still creates an Etsy listing backup by default.

## Security boundaries

The path must be absolute and strictly inside the configured directory. Traversal, symlinks in the path, empty files, oversized files, and content that does not match its .jpg/.jpeg/.png/.webp extension are rejected **before the Etsy API call**. The Etsy service user needs read access; the directory should not be writable by untrusted processes. Avoid concurrently modifying a staged file while it is uploaded.

This mechanism does not transfer files from ChatGPT's /mnt/data by itself; use a separate approved transfer mechanism to stage those files.
