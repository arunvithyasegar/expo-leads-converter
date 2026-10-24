"""
Anna Incubator ETM CRM - Local Whishper Transcription Adapter
Communicates locally with self-hosted Whishper (Tag v3.1.4 / main).
No third-party cloud services, no paid API keys.
"""

import os
import json
import time
import urllib.request
import urllib.error
import mimetypes
import uuid

WHISHPER_BASE_URL = os.environ.get("WHISHPER_BASE_URL", "http://127.0.0.1:8082").rstrip("/")
WHISHPER_API_KEY = os.environ.get("WHISHPER_API_KEY", "")

class WhishperClient:
    def __init__(self, base_url=None, api_key=None):
        self.base_url = (base_url or WHISHPER_BASE_URL).rstrip("/")
        self.api_key = api_key if api_key is not None else WHISHPER_API_KEY

    def check_health(self):
        """
        Verifies if the local Whishper service or standalone worker is reachable.
        Returns dict with status, mode, and response details.
        """
        headers = {"User-Agent": "AnnaETM-CRM-Adapter/1.0"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        # 1. Check Whishper Full Suite endpoint (/api/transcriptions)
        try:
            url = f"{self.base_url}/api/transcriptions"
            req = urllib.request.Request(url, headers=headers, method="GET")
            with urllib.request.urlopen(req, timeout=2.5) as resp:
                if resp.status in (200, 201):
                    return {
                        "online": True,
                        "mode": "whishper-full-suite",
                        "url": self.base_url,
                        "status": "ready",
                        "message": "Local Whishper full service is active and responding."
                    }
        except Exception as e:
            full_err = str(e)

        # 2. Check Whishper Standalone Faster-Whisper Worker (/healthcheck/)
        try:
            url = f"{self.base_url}/healthcheck/"
            req = urllib.request.Request(url, headers=headers, method="GET")
            with urllib.request.urlopen(req, timeout=2.5) as resp:
                if resp.status == 200:
                    return {
                        "online": True,
                        "mode": "whishper-worker-api",
                        "url": self.base_url,
                        "status": "ready",
                        "message": "Local Whishper worker API is active and healthy."
                    }
        except Exception as e:
            worker_err = str(e)

        return {
            "online": False,
            "mode": "offline",
            "url": self.base_url,
            "status": "offline",
            "message": f"Local Whishper service is not reachable at {self.base_url}. Audio recordings remain safely preserved on local disk."
        }

    def submit_audio(self, audio_file_path, options=None):
        """
        Submits audio file to Whishper service via multipart/form-data.
        Options:
          model_size: 'tiny', 'base', 'small', 'medium', 'large-v2', 'large-v3' (default 'small')
          language: 'auto' or ISO code like 'en', 'hi' (default 'auto')
          device: 'cpu' or 'cuda' (default 'cpu')
        """
        if not os.path.exists(audio_file_path):
            raise FileNotFoundError(f"Audio file not found: {audio_file_path}")

        opts = options or {}
        model_size = opts.get("model_size", "small")
        language = opts.get("language", "auto")
        device = opts.get("device", "cpu")

        filename = os.path.basename(audio_file_path)
        mime_type = mimetypes.guess_type(audio_file_path)[0] or "audio/webm"

        # Check health mode
        health = self.check_health()
        if not health["online"]:
            return {
                "success": False,
                "offline": True,
                "error": "Local Whishper service is offline. Recording preserved locally."
            }

        boundary = f"----WebKitFormBoundary{uuid.uuid4().hex}"
        body_parts = []

        def add_field(name, value):
            body_parts.append(f"--{boundary}\r\n".encode("utf-8"))
            body_parts.append(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode("utf-8"))
            body_parts.append(f"{value}\r\n".encode("utf-8"))

        if health["mode"] == "whishper-full-suite":
            endpoint = f"{self.base_url}/api/transcriptions"
            add_field("language", language)
            add_field("modelSize", model_size)
            add_field("device", device)
            add_field("task", "transcribe")
        else:
            endpoint = f"{self.base_url}/transcribe/"
            add_field("language", language)
            add_field("model_size", model_size)
            add_field("device", device)

        # File payload
        body_parts.append(f"--{boundary}\r\n".encode("utf-8"))
        body_parts.append(f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'.encode("utf-8"))
        body_parts.append(f"Content-Type: {mime_type}\r\n\r\n".encode("utf-8"))

        with open(audio_file_path, "rb") as f:
            file_data = f.read()
        body_parts.append(file_data)
        body_parts.append(b"\r\n")
        body_parts.append(f"--{boundary}--\r\n".encode("utf-8"))

        full_body = b"".join(body_parts)

        headers = {
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "Content-Length": str(len(full_body)),
            "User-Agent": "AnnaETM-CRM-Adapter/1.0"
        }
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        req = urllib.request.Request(endpoint, data=full_body, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=300) as resp:
                data = json.loads(resp.read().decode("utf-8"))

                # In Whishper full suite: data has 'id' (mongo ObjectID) and 'status' (0=pending)
                if "id" in data:
                    job_id = str(data["id"])
                    raw_status = data.get("status", 0)
                    crm_status = "completed" if raw_status == 2 else ("processing" if raw_status == 1 else "pending")
                    result = data.get("result", {})
                    return {
                        "success": True,
                        "job_id": job_id,
                        "status": crm_status,
                        "raw_data": data,
                        "text": result.get("text", ""),
                        "segments": result.get("segments", []),
                        "language": data.get("language", language)
                    }
                # Standalone worker endpoint returns result immediately
                elif "text" in data or "segments" in data:
                    return {
                        "success": True,
                        "job_id": f"worker-{int(time.time())}",
                        "status": "completed",
                        "raw_data": data,
                        "text": data.get("text", ""),
                        "segments": data.get("segments", []),
                        "language": data.get("language", language)
                    }
                else:
                    return {
                        "success": True,
                        "job_id": str(data.get("_id", uuid.uuid4().hex)),
                        "status": "pending",
                        "raw_data": data
                    }
        except Exception as e:
            return {
                "success": False,
                "offline": False,
                "error": f"Whishper submission error: {str(e)}"
            }

    def get_job_status(self, job_id):
        """
        Polls Whishper for the status and result of a transcription job.
        Status map:
          0 -> pending
          1 -> processing
          2 -> completed
          -1 -> failed
        """
        if not job_id or job_id.startswith("worker-"):
            return None

        url = f"{self.base_url}/api/transcriptions/{job_id}"
        headers = {"User-Agent": "AnnaETM-CRM-Adapter/1.0"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        req = urllib.request.Request(url, headers=headers, method="GET")
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                raw_status = data.get("status", 0)

                status_map = {
                    0: "pending",
                    1: "processing",
                    2: "completed",
                    -1: "failed"
                }
                status_str = status_map.get(raw_status, "processing")
                result = data.get("result", {})

                return {
                    "job_id": job_id,
                    "status": status_str,
                    "raw_status": raw_status,
                    "text": result.get("text", ""),
                    "segments": result.get("segments", []),
                    "language": data.get("language", "auto"),
                    "raw_data": data
                }
        except Exception as e:
            return {
                "job_id": job_id,
                "status": "error",
                "error": str(e)
            }

    def delete_remote_job(self, job_id):
        """
        Optionally deletes transcription from Whishper server when deleted in CRM.
        """
        if not job_id or job_id.startswith("worker-"):
            return True
        url = f"{self.base_url}/api/transcriptions/{job_id}"
        headers = {"User-Agent": "AnnaETM-CRM-Adapter/1.0"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        try:
            req = urllib.request.Request(url, headers=headers, method="DELETE")
            with urllib.request.urlopen(req, timeout=5) as resp:
                return resp.status in (200, 204)
        except Exception:
            return False

# Export singleton
default_client = WhishperClient()
