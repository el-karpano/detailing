"""Inspect schwartz live bundle for branding leaks and service data."""
import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0"}
base = "https://detailing-schwartz.deteiling-pro.workers.dev"
html = urllib.request.urlopen(urllib.request.Request(base + "/", headers=UA), timeout=20).read().decode("utf-8", "replace")
js_path = re.findall(r'src="(/assets/index-[^"]+\.js)"', html)[0]
js = urllib.request.urlopen(urllib.request.Request(base + js_path, headers=UA), timeout=20).read().decode("utf-8", "replace")
print("bundle", js_path, "len", len(js))
for t in ["SGX", "sgx", "Калиновского", "ХВВ", "SCHWARTZ", "svc-polish", "svc-ceramic", "svc-biled",
          "Полировка кузова", "Химчистка салона", "Установка Bi-Led", "Дорожная", "375 33 375",
          "logo.jpg", "hero-car-blue", "detailing-schwartz", "studio-schwartz"]:
    print(f"{t!r:30s} {js.count(t)}")
idx = js.find("SGX")
print("--- SGX context ---")
print(js[max(0, idx - 100): idx + 100] if idx >= 0 else "none")
idx2 = js.find("sgx")
print("--- sgx context ---")
print(js[max(0, idx2 - 100): idx2 + 100] if idx2 >= 0 else "none")
