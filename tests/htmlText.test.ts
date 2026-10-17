import { describe, it, expect } from "vitest";
import { htmlToText, decodeEntities } from "@/lib/htmlText";

const noMarkup = (s: string) => {
  expect(s).not.toMatch(/[<>]/);
};

describe("htmlToText", () => {
  it("removes <script> blocks including their contents", () => {
    const out = htmlToText("Hello <script>alert(1)</script>world");
    expect(out).toBe("Hello world");
    noMarkup(out);
  });

  it("handles nested/split tags like <scr<script>ipt> without leaving a tag behind", () => {
    for (const input of ["<scr<script>ipt>alert(1)</scr</script>ipt>", "<scr<script>ipt>alert(1)</script>", "<<script>script>alert(1)<</script>/script>"]) {
      const out = htmlToText(input);
      noMarkup(out);
      expect(out.toLowerCase()).not.toContain("<script");
    }
  });

  it("decodes double-encoded entities exactly once", () => {
    expect(htmlToText("Tom &amp;amp; Jerry")).toBe("Tom &amp; Jerry");
    const out = htmlToText("&amp;lt;b&amp;gt;bold&amp;lt;/b&amp;gt;");
    expect(out).toBe("&lt;b&gt;bold&lt;/b&gt;"); // one decode only, still not markup
    noMarkup(out);
  });

  it("drops unclosed tags", () => {
    expect(htmlToText("before <b>bold")).toBe("before bold");
    for (const input of ["text <img src=x onerror=alert(1)", "text <div class=\"a", "text <", "text <a href='x"]) {
      const out = htmlToText(input);
      noMarkup(out);
      expect(out).not.toMatch(/onerror|href/);
    }
  });

  it("drops comments, including unterminated ones", () => {
    expect(htmlToText("a<!-- hidden <b>x</b> -->b")).toBe("ab");
    const out = htmlToText("a<!-- never closed <script>alert(1)</script>");
    noMarkup(out);
    expect(out).not.toContain("alert");
  });

  it("drops attributes such as onerror/onclick/href", () => {
    const out = htmlToText('<img src="x" onerror="alert(1)">Caption <a href="javascript:alert(1)" onclick="x()">link</a>');
    expect(out).toBe("Caption link");
  });

  it("decodes numeric and hex entities once and never leaves angle brackets", () => {
    for (const input of ["&#x3C;script&#x3E;alert(1)&#x3C;/script&#x3E;", "&#60;script&#62;alert(1)&#60;/script&#62;", "&lt;script&gt;alert(1)&lt;/script&gt;"]) {
      const out = htmlToText(input);
      noMarkup(out);
    }
    expect(htmlToText("Caf&#233; &#x1F600; &#8217;s")).toBe("Café 😀 ’s");
  });

  it("decodes common entities", () => {
    expect(htmlToText("Fish &amp; Chips &quot;quoted&quot; it&#39;s&nbsp;fine")).toBe("Fish & Chips \"quoted\" it's fine");
  });

  it("drops style and noscript bodies", () => {
    expect(htmlToText("a<style>body{color:red}</style>b<noscript>no</noscript>c")).toBe("a b c");
  });

  it("separates words that were split by tags and collapses whitespace", () => {
    expect(htmlToText("<p>one</p><p>two</p>\n\n  <br/>three")).toBe("one two three");
  });

  it("strips an <img> description blurb to nothing", () => {
    expect(htmlToText('<img src="https://x/y.png" />')).toBe("");
  });

  it("is plain text for adversarial mixes", () => {
    const nasty = [
      "<svg/onload=alert(1)>",
      "<iframe src=javascript:alert(1)></iframe>",
      "<a href=\"x\">a</a><script>1</script><SCRIPT>2</SCRIPT>",
      "<math><mi xlink:href=\"data:x\">",
      "<![CDATA[<script>alert(1)</script>]]>",
      "<?php echo 1; ?>",
      "&#0;&#x0;<b\u0000>",
    ];
    for (const n of nasty) noMarkup(htmlToText(n));
  });
});

describe("decodeEntities", () => {
  it("decodes once", () => {
    expect(decodeEntities("&amp;lt;")).toBe("&lt;");
    expect(decodeEntities("&#8220;hi&#8221; &amp; bye")).toBe("“hi” & bye");
  });
  it("does not strip tags (text only)", () => {
    expect(decodeEntities("a &lt;b&gt; c")).toBe("a <b> c");
  });
});
