export async function onRequestPost(context) {
  try {
    const req = context.request;

    // Parse multipart form data
    const formData = await req.formData();

    // Required fields
    const companyName = String(formData.get("companyName") || "").trim();
    const contactName = String(formData.get("contactName") || "").trim();
    const pickupCityState = String(formData.get("pickupCityState") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const phone = String(formData.get("phone") || "").trim();

    // Optional fields
    const notes = String(formData.get("notes") || "").trim();

    // Optional file upload
    const file = formData.get("inventoryFile");

    // Validate required fields
    if (!companyName || !contactName || !pickupCityState || !email || !phone) {
      return new Response("Missing required fields", { status: 400 });
    }

    // Email routing variables
    const toEmail = context.env.TO_EMAIL || "sales@wipe-recycle.com";
    const fromEmail = context.env.FROM_EMAIL || "sales@wipe-recycle.com";

    // -----------------------------
    // Optional Attachment Handling
    // -----------------------------
    let attachments = [];

    if (file && file instanceof File && file.size > 0) {
      const maxBytes = 8 * 1024 * 1024; // 8MB limit

      if (file.size > maxBytes) {
        return new Response(
          "File too large (max 8MB). Please email it directly to sales@wipe-recycle.com instead.",
          { status: 413 }
        );
      }

      // Convert file to base64
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);

      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }

      attachments.push({
        content: btoa(binary),
        filename: file.name,
        type: file.type || "application/octet-stream",
        disposition: "attachment"
      });
    }

    // -----------------------------
    // Build Email Content
    // -----------------------------
    const subject = `New Equipment Inquiry: ${companyName} (${pickupCityState})`;

    const fileStatus =
      file && file instanceof File && file.size > 0
        ? `${file.name} (${Math.round(file.size / 1024)} KB)`
        : "(none provided)";

    const textBody = `
New equipment inquiry received from wipe-recycle.com

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

    // -----------------------------
    // MailChannels Payload
    // -----------------------------
    const mailPayload = {
      personalizations: [
        {
          to: [{ email: toEmail }]
        }
      ],
      from: {
        email: fromEmail,
        name: "wipe-recycle.com"
      },
      reply_to: {
        email: email,
        name: contactName
      },
      subject: subject,
      content: [
        {
          type: "text/plain",
          value: textBody
        }
      ],
      attachments: attachments
    };

    // -----------------------------
    // Send via MailChannels API
    // -----------------------------
    const resp = await fetch("https://api.mailchannels.net/tx/v1/send", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(mailPayload)
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return new Response(`Email failed: ${errText}`, { status: 502 });
    }

    return new Response("OK", { status: 200 });

  } catch (err) {
    return new Response("Server error", { status: 500 });
  }
}
