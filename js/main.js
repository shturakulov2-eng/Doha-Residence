(function () {
  var START_NUMBER = 41;
  var SUBMIT_TIMEOUT_MS = 3500;
  var LOCAL_KEY = "doha_lead_number";

  var form = document.getElementById("leadForm");
  var nameInput = document.getElementById("name");
  var phoneInput = document.getElementById("phone");
  var nameField = document.getElementById("nameField");
  var phoneField = document.getElementById("phoneField");
  var submitBtn = document.getElementById("submitBtn");

  function digitsOnly(value) {
    var d = value.replace(/\D/g, "");
    if (d.length > 9 && d.indexOf("998") === 0) d = d.slice(3);
    return d.slice(0, 9);
  }

  function formatPhone(d) {
    var parts = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)];
    return parts.filter(Boolean).join(" ");
  }

  phoneInput.addEventListener("input", function () {
    phoneInput.value = formatPhone(digitsOnly(phoneInput.value));
    phoneField.classList.remove("is-error");
  });

  nameInput.addEventListener("input", function () {
    nameField.classList.remove("is-error");
  });

  function flagError(field) {
    field.classList.remove("is-error");
    void field.offsetWidth;
    field.classList.add("is-error");
  }

  function nextLocalNumber() {
    var n = START_NUMBER;
    try {
      var last = parseInt(localStorage.getItem(LOCAL_KEY), 10);
      if (last >= START_NUMBER) n = last + 1;
      localStorage.setItem(LOCAL_KEY, String(n));
    } catch (e) {}
    return n;
  }

  function goToWelcome(number) {
    window.location.href = "/welcome?n=" + encodeURIComponent(number);
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    var name = nameInput.value.trim();
    var phone = digitsOnly(phoneInput.value);
    var valid = true;

    if (name.replace(/[^\p{L}]/gu, "").length < 2) {
      flagError(nameField);
      valid = false;
    }
    if (phone.length !== 9) {
      flagError(phoneField);
      valid = false;
    }
    if (!valid) {
      if (navigator.vibrate) navigator.vibrate(80);
      return;
    }

    submitBtn.classList.add("is-loading");
    nameInput.blur();
    phoneInput.blur();

    var done = false;
    function finish(serverNumber) {
      if (done) return;
      done = true;
      var n = parseInt(serverNumber, 10);
      goToWelcome(n >= START_NUMBER ? n : nextLocalNumber());
    }

    setTimeout(function () { finish(null); }, SUBMIT_TIMEOUT_MS);

    fetch("/api/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name,
        phone: "+998" + phone,
        page: location.href,
        referrer: document.referrer || null
      }),
      keepalive: true
    })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) { finish(data && data.number); })
      .catch(function () { finish(null); });
  });
})();
