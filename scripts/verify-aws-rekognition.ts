import "dotenv/config";
import { verifyAwsRekognitionAccess } from "../src/lib/aws/rekognition";

async function main() {
  const result = await verifyAwsRekognitionAccess();
  console.log(`Region: ${result.region}`);
  console.log(`Similarity threshold: ${result.similarityThreshold}%`);
  console.log(result.ok ? "OK:" : "FAIL:", result.message);

  if (!result.ok) {
    console.log("\nNext steps:");
    console.log("1. Create IAM user with docs/aws-rekognition-iam-policy.json");
    console.log("2. Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION in .env.local and Vercel");
    console.log("3. Run migration 015_default_aws_biometric.sql in Supabase");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
