const nodemailer = require("nodemailer");

//to can also take array of valid emails
async function mail(to, content) {
  const testAccount = await nodemailer.createTestAccount();
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "tu30082022@gmail.com",
      pass: process.env.MAIL_PASS,
    },
  });
  let info = await transporter.sendMail({
    from: "admin@property247.com",
    to,
    subject: "Check!",
    text: "Text Here!",
    html: content,
  });

  console.log("Message sent: %s", info.messageId);
  console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
}

module.exports = mail;
