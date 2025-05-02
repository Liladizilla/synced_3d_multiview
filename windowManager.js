if (window.name === "") {
    window.name = "Main";
    setInterval(() => {
      if (window.open("", "Child") === null) {
        window.open(window.location.href, "Child");
      }
    }, 3000); // open a synced window every 3s if not open
  }