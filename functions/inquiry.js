export async function onRequest(context) {
  // Handle preflight (optional, but solid)
  if (context.request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      }
    });
  }

  if (context.request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const formData = await context.request.formData();

    const companyName = String(formData.get("companyName") || "").trim();
    const contactName = String(formData.get("contactName") || "").trim();
    const pickupCityState = String(formData.get("pickupCityState") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const phone = String(formData.get("phone") || "").trim();
    const notes = String(formData.get("notes") || "").trim();

    const file = formData.get("inventoryFile");

    if (!companyName || !contactName || !pickupCityState || !email || !phone) {
      return new Response("Missing required fields", { status: 400 });
    }

    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailOk) {
      return new Response("Invalid email address", { status: 400 });
    }

    const toEmail = context.env.TO_EMAIL || "sales@wipe-recycle.com";
    const fromEmail = context.env.FROM_EMAIL || "sales@wipe-recycle.com";

    let attachments = [];

    if (file && file instanceof File && file.size > 0) {
      const maxBytes = 8 * 1024 * 1024;
      if (file.size > maxBytes) {
        return new Response(
          "File too large (max 8MB). Please email it directly to sales@wipe-recycle.com instead.",
          { status: 413 }
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);

      // base64 encode safely in chunks
      let binary = "";
      const chunkSize = 0x8000;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
      }

      attachments.push({
        content: btoa(binary),
        filename: file.name,
        type: file.type || "application/octet-stream",
        disposition: "attachment"
      });
    }

    const subject = `New Equipment Inquiry: ${companyName} (${pickupCityState})`;

    const fileStatus =
      file && file instanceof File && file.size > 0
        ? `${file.name} (${Math.round(file.size / 1024)} KB)`
        : "(none provided)";

    const textBody =
`New equipment inquiry received from wipe-recycle.com

----------------------------------------
Company Name:       ${companyName}
Contact Name:       ${contactName}
Pickup Location:    ${pickupCityState}
Email:              ${email}
Phone:              ${phone}
Inventory Upload:   ${fileStatus}

Notes:
${notes || "(none)"}
----------------------------------------

Reply directly to this email to contact the requester.

— Wipe & Recycle IT
`;

    const mailPayload = {
      personalizations: [{ to: [{ email: toEmail }] }],
      from: { email: fromEmail, name: "Wipe & Recycle IT" },
      reply_to: { email, name: contactName },
      subject,
      content: [{ type: "text/plain", value: textBody }],
      attachments
    };

const resp = await fetch("https://api.mailchannels.net/tx/v1/send", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(mailPayload)
});

const respText = await resp.text();
console.log("MailChannels status:", resp.status);
console.log("MailChannels response:", respText);

if (!resp.ok) {
  return new Response(`Email failed: ${respText}`, { status: 502 });
}


    return new Response("OK", {
      status: 200,
      headers: { "Access-Control-Allow-Origin": "*" }
    });
  } catch (err) {
    return new Response("Server error", { status: 500 });
  }
}
