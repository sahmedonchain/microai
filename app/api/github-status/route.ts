import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const repo = searchParams.get("repo");

  if (!repo) {
    return NextResponse.json({ error: "Missing repo" }, { status: 400 });
  }

  const token = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    "Accept": "application/vnd.github.v3+json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const res = await fetch(`https://api.github.com/repos/${repo}`, {
      headers,
      next: { revalidate: 3600 }, // cache 1 hour
    });

    if (!res.ok) {
      return NextResponse.json({ error: `GitHub API error: ${res.status}` }, { status: res.status });
    }

    const data = await res.json();

    return NextResponse.json({
      pushedAt: data.pushed_at,
      updatedAt: data.updated_at,
      stars: data.stargazers_count,
      forks: data.forks_count,
      name: data.full_name,
    });
  } catch (err: unknown) {
    console.error("GitHub status error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}