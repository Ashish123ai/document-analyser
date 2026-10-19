"""Browser end-to-end test: drives the real UI against a RUNNING stack.

    pip install playwright && playwright install chromium
    APP=http://localhost:5173 python e2e/ui_flow.py

Covers: register, upload, processing, analysis, risks/clauses, report download, chat with
citations, refusal of unanswerable questions, history, dashboard, session reload, sign-out,
route protection and the forgot/reset password flow. Needs the backend running with
NODE_ENV != production and no SMTP configured (so the reset link is shown on screen).
"""
import os

APP = os.environ.get("APP", "http://localhost:5173")
SAMPLE = os.path.join(os.path.dirname(__file__), "..", "samples", "sample_lease.txt")
from playwright.sync_api import sync_playwright, expect
import time
errors=[]; stamp=int(time.time())
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width":1280,"height":850})
    pg.on("pageerror", lambda e: errors.append("PAGEERROR "+str(e)))
    pg.on("console", lambda m: errors.append("CONSOLE "+m.text) if m.type=="error" and "fonts" not in m.text and "ERR_NAME" not in m.text and "ERR_INTERNET" not in m.text else None)
    step=lambda s: print("  ok  ", s)

    pg.goto(APP + "/register")
    pg.fill("#name","UI Tester"); pg.fill("#email",f"ui{stamp}@example.com")
    pg.fill("#password","Str0ngPass1"); pg.fill("#confirm","Str0ngPass1")
    pg.click("button:has-text('Create account')")
    pg.wait_for_url("**/dashboard"); expect(pg.get_by_text("Welcome back, UI")).to_be_visible(); step("register -> dashboard")

    pg.click("nav >> text=Documents"); pg.wait_for_url("**/documents")
    pg.set_input_files("#file-input",SAMPLE)
    expect(pg.get_by_text("sample_lease.txt").first).to_be_visible(timeout=10000)
    expect(pg.locator("li").filter(has_text="sample_lease.txt").get_by_text("Ready")).to_be_visible(timeout=20000); step("upload -> processing -> Ready (polling)")
    pg.screenshot(path="/tmp/real_docs.png")

    pg.click("a:has-text('sample_lease.txt')"); expect(pg.get_by_role("heading",name="Analyze this document")).to_be_visible()
    pg.click("button:has-text('Run analysis')")
    expect(pg.get_by_role("tab",name="Summary")).to_be_visible(timeout=30000); step("analysis completed")
    expect(pg.get_by_text("Lease / rental agreement").first).to_be_visible(); step("summary rendered")
    pg.click("#tab-risks"); expect(pg.get_by_text("Unlimited liability").first).to_be_visible(); expect(pg.get_by_text("High risk").first).to_be_visible(); step("risks tab rendered")
    pg.screenshot(path="/tmp/real_risks.png")
    pg.click("#tab-clauses"); expect(pg.get_by_role("heading",name="Termination")).to_be_visible(); step("clauses tab rendered")
    with pg.expect_download() as d: pg.click("button:has-text('Export report')")
    assert d.value.suggested_filename.endswith("-analysis.md"); step("report download: "+d.value.suggested_filename)

    pg.click("a:has-text('Ask questions')"); pg.wait_for_url("**/chat/**")
    pg.fill("#question","How much notice must the tenant give to terminate early?"); pg.keyboard.press("Enter")
    expect(pg.get_by_text("From the document").first).to_be_visible(timeout=15000); step("chat answer with sources")
    expect(pg.locator("mark.hl").first).to_be_visible(); step("question words highlighted in source")
    pg.screenshot(path="/tmp/real_chat.png")
    pg.fill("#question","quantum chromodynamics gluon spectroscopy"); pg.keyboard.press("Enter")
    expect(pg.get_by_text("I could not find this information in the uploaded document.")).to_be_visible(timeout=15000); step("unanswerable question refused")

    pg.click("nav >> text=History"); expect(pg.get_by_text("How much notice must the tenant")).to_be_visible(); step("history lists questions")
    pg.click("nav >> text=Dashboard"); expect(pg.get_by_text("Risks across your documents")).to_be_visible(); expect(pg.get_by_text("High:")).to_be_visible(); step("dashboard shows risk bar")
    pg.screenshot(path="/tmp/real_dash.png")
    pg.click("nav >> text=Profile"); expect(pg.get_by_text("Created your account").first).to_be_visible(); step("profile activity log")

    pg.reload(); expect(pg.get_by_text("UI Tester").first).to_be_visible(); step("session survives reload (token validation)")
    pg.click("button:has-text('Sign out')"); pg.wait_for_url("**/login"); step("sign out")
    pg.goto(APP + "/documents"); pg.wait_for_url("**/login"); step("protected route redirects to login")

    pg.click("text=Forgot your password?"); pg.fill("#email",f"ui{stamp}@example.com"); pg.click("button:has-text('Send reset link')")
    link = pg.locator("a[href*='reset-password']"); expect(link).to_be_visible(); href = link.get_attribute("href")
    pg.goto(href.replace("http://localhost:5173",APP))
    pg.fill("#password","NewStr0ngPass9"); pg.fill("#confirm","NewStr0ngPass9"); pg.click("button:has-text('Update password')")
    pg.wait_for_url("**/login"); pg.fill("#email",f"ui{stamp}@example.com"); pg.fill("#password","NewStr0ngPass9"); pg.click("button:has-text('Sign in')")
    pg.wait_for_url("**/dashboard"); step("forgot -> reset -> sign in with new password")
    b.close()
print("BROWSER ERRORS:", errors or "none")
