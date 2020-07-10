function CEdit(textarea) {
  if (!(textarea instanceof HTMLTextAreaElement)) {
    throw new TypeError("Parameter has to be of type HTMLTextAreaElement (but was " + textarea.constructor.name + ")");
  }

  var TOOLBARGROUP_NONE   = 0;
  var TOOLBARGROUP_BEGIN  = 1;
  var TOOLBARGROUP_INSIDE = 2;
  var TOOLBARGROUP_END    = 3;

  // ========================================================================= //

  function insert_around_selection(before, after) {
    var newCaret = -1;
    if (after === null && before.indexOf("|") >= 0) {
      newCaret = before.indexOf("|");
      before = before.replace(/\|/g, "");
    }
    var beforeIndex = Math.min(textarea.selectionStart, textarea.selectionEnd);
    var afterIndex = Math.max(textarea.selectionStart, textarea.selectionEnd);
    textarea.value =
      textarea.value.substring(0, beforeIndex) +
      before + textarea.value.substring(beforeIndex, afterIndex) + (after || "") +
      textarea.value.substring(afterIndex, textarea.value.length);
    if (newCaret >= 0) {
      textarea.selectionStart = 
        textarea.selectionEnd = beforeIndex + newCaret;
    } else {
      textarea.selectionStart = beforeIndex + before.length;
      textarea.selectionEnd = afterIndex + before.length;
    }
  }
  function remove_around_selection(before, after) {
    if (after === null)
      throw new TypeError("Second parameter cannot be null");
    var beforeIndex = Math.min(textarea.selectionStart, textarea.selectionEnd);
    var afterIndex = Math.max(textarea.selectionStart, textarea.selectionEnd);
    textarea.value =
      textarea.value.substring(0, beforeIndex - before.length) +
      textarea.value.substring(beforeIndex, afterIndex) +
      textarea.value.substring(afterIndex + after.length, textarea.value.length);
    textarea.selectionStart = beforeIndex - before.length;
    textarea.selectionEnd = afterIndex - before.length;
  }
  function is_around_selection(before, after) {
    var beforeIndex = Math.min(textarea.selectionStart, textarea.selectionEnd);
    var afterIndex = Math.max(textarea.selectionStart, textarea.selectionEnd);
    return (
      (textarea.value.substr(beforeIndex - before.length, before.length) === before) &&
      (textarea.value.substr(afterIndex, after.length) === after)
    );
  }
  function toggle_around_selection(before, after) {
    if (is_around_selection(before, after))
      remove_around_selection(before, after);
    else
      insert_around_selection(before, after);
  }
  function register_command_text(id, combo, before, after, displayname, insert_only) {
    if (insert_only !== true)
      insert_only = false;
    var keys = null;
    if (combo !== null) {
      var tokens = combo.toLowerCase().split("-");
      var k_ctrl = tokens.indexOf("ctrl") >= 0;
      var k_alt = tokens.indexOf("alt") >= 0;
      var k_shift = tokens.indexOf("shift") >= 0;
      var k_key = tokens[tokens.length - 1];
      keys = {
        "key": k_key,
        "ctrl": k_ctrl,
        "shift": k_shift,
        "alt": k_alt
      };
    }
    commands[id] = {
      "displayname": displayname,
      "type": "insert",
      "insertonly": insert_only,
      "keys": keys,
      "insert": {
        "before": before,
        "after": after
      }
    };
  }
  function register_command(id, combo, displayname, callback) {
    var keys = null;
    if (combo !== null) {
      var tokens = combo.toLowerCase().split("-");
      var k_ctrl = tokens.indexOf("ctrl") >= 0;
      var k_alt = tokens.indexOf("alt") >= 0;
      var k_shift = tokens.indexOf("shift") >= 0;
      var k_key = tokens[tokens.length - 1];
      keys = {
        "key": k_key,
        "ctrl": k_ctrl,
        "shift": k_shift,
        "alt": k_alt
      };
    }
    commands[id] = {
      "displayname": displayname,
      "type": "callback",
      "keys": keys,
      "callback": callback
    };
  }
  function execute_command(command) {
    if (command.type === "insert") {
      if (command.insertonly)
        insert_around_selection(command.insert.before, command.insert.after);
      else
        toggle_around_selection(command.insert.before, command.insert.after);
    } else if (command.type === "callback") {
      command.callback();
    }
  }
  function add_toolbar_button(text, command, tooltip) {
    var tb = document.createElement("button");
    tb.type = "button";
    tb.title = tooltip;
    var group_suffix = "";
    if (statem.tbgroup === TOOLBARGROUP_BEGIN)
      group_suffix = " cedit-toolbar-button-group-begin";
    else if (statem.tbgroup === TOOLBARGROUP_INSIDE)
      group_suffix = " cedit-toolbar-button-group-inside";
    else if (statem.tbgroup === TOOLBARGROUP_END)
      group_suffix = " cedit-toolbar-button-group-end";
    tb.className = "cedit-toolbar-button" + group_suffix;
    tb.addEventListener("click", function() {
      try {
        execute_command(commands[command]);
      } catch(ex) {
        console.error(ex);
        alert(ex);
      }
      textarea.focus();
    });
    tb.innerText = text;
    toolbar_container.appendChild(tb);
    tbbuttons.push({
      "text": text,
      "command": command,
      "tooltip": tooltip,
      "DOMelement": tb
    });
    if (statem.tbgroup === TOOLBARGROUP_BEGIN)
      statem.tbgroup = TOOLBARGROUP_INSIDE;
    else if (statem.tbgroup === TOOLBARGROUP_END)
      statem.tbgroup = TOOLBARGROUP_NONE;
    return tb;
  }
  function add_toolbar_separator() {
    var sp = document.createElement("div");
    sp.className = "cedit-toolbar-separator";
    toolbar_container.appendChild(sp);
  }
  function tb_begin_group() {
    statem.tbgroup = TOOLBARGROUP_BEGIN;
  }
  function tb_end_group() {
    statem.tbgroup = TOOLBARGROUP_END;
  }

  function ev_selection_change() {
    if (document.activeElement === textarea) {
      Object.keys(commands).map(function(e) {
        return [e, commands[e]];
      }).forEach(function(parts) {
        var id = parts[0];
        var command = parts[1];
        if (command.type !== "insert")
          return;
        var should_highlight = false;

        if (
          !command.insertonly &&
          command.insert.after !== null &&
          is_around_selection(command.insert.before, command.insert.after)) { 
          should_highlight = true;
        }

        var found_buttons = tbbuttons.filter(function(e) {
          return e.command == id;
        });
        if (found_buttons.length < 1)
          return;
        var found_button = found_buttons[0];
        found_button.DOMelement.classList.toggle("cedit-toolbar-button-highlighted", should_highlight);
      });
    }
  }
  function submit_if_in_form() {
    var parent = textarea;
    while (!(parent instanceof HTMLFormElement)) {
      parent = parent.parentElement;
      if (parent === document.documentElement)
        // No form found, do nothing
        return;
    }
    // Form found, submit it
    if (parent.checkValidity())
      parent.submit();
    else
      alert("Form is not valid, please check input");
  }
  function pad_str_right(str, n, pad_str) {
    if (!pad_str) pad_str = " ";
    return (str + repeat_string(pad_str, n)).substring(0, n);
  }
  function repeat_string(str, n) {
    var repeated_string = "";
    while (n > 0) {
      repeated_string += str;
      n--;
    }
    return repeated_string;
  }
  function show_help() {
    var help_parts = [];
    Object.keys(commands).map(function(e) {
      return [e, commands[e]];
    }).forEach(function(parts) {
      help_parts.push([parts[1].displayname, make_key_combo_str(parts[1].keys)]);
    });
    var max_length = Math.max.apply(null, help_parts.map(function(e) {
      return e[0].length;
    })) + 2;
    var str = "";
    help_parts.forEach(function(part) {
      str += pad_str_right(part[0] + " ", max_length, ".") + " " + part[1] + "\n";
    });
    show_alert(str);
  }
  function upper_case_first(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
  function make_key_combo_str(keys) {
    return [
      keys.ctrl ? "Ctrl" : null,
      keys.alt ? "Alt" : null,
      keys.shift ? "Shift" : null,
      upper_case_first(keys.key)
    ].filter(Boolean).join("-");
  }
  function show_alert(message) {
    var alert_root = document.createElement("div");
    var alert_message = document.createElement("div");
    var alert_buttons = document.createElement("div");
    var alert_button = document.createElement("button");

    alert_root.className = "cedit-alert-root";
    alert_message.className = "cedit-alert-message";
    alert_buttons.className = "cedit-alert-buttons";
    alert_button.className = "cedit-alert-button";

    alert_button.innerText = "Dismiss";
    alert_button.addEventListener("click", function() {
      set_toolbar_buttons_enabled(true);
      set_textbox_enabled(true);
      outer_container.removeChild(alert_root);
      textarea.focus();
    });
    alert_message.innerText = message;
    alert_buttons.appendChild(alert_button);
    alert_root.appendChild(alert_message);
    alert_root.appendChild(alert_buttons);
    outer_container.appendChild(alert_root);
    alert_button.focus();
    set_toolbar_buttons_enabled(false);
    set_textbox_enabled(false);
  }
  function set_toolbar_buttons_enabled(enabled) {
    Object.keys(tbbuttons).map(function(e) {
      return tbbuttons[e].DOMelement;
    }).forEach(function(tbtn) {
      if (enabled)
        tbtn.removeAttribute("disabled");
      else
        tbtn.setAttribute("disabled", "disabled");
    });
  }
  function set_textbox_enabled(enabled) {
    if (enabled)
      textarea.removeAttribute("disabled");
    else
      textarea.setAttribute("disabled", "disabled");
  }
  function select_current_token() {
    var left_index = Math.min(textarea.selectionStart, textarea.selectionEnd);
    var right_index = Math.max(textarea.selectionStart, textarea.selectionEnd);
    textarea.selectionStart = left_index;
    textarea.selectionEnd = right_index;
    var available_tokens = Object.values(commands).filter(function(c) {
      return c.type === "insert";
    }).map(function(c) {
      return c.insert;
    });
    var right_token = null;
    var left_continue = true;
    while (left_index > 0 && left_continue) {
      for (var token of available_tokens) {
        if (textarea.value.substr(left_index - token.before.length, token.before.length) === token.before) {
          right_token = token.after;
          left_continue = false;
          break;
        }
      }
      if (left_continue)
        left_index--;
    }
    if (right_token === null)
      return;
    var right_found = false;
    while (right_index < textarea.value.length - 1) {
      if (textarea.value.substr(right_index, right_token.length) === right_token) {
        right_found = true;
        break;
      }
      right_index++;
    }

    if (right_found) {
      textarea.selectionStart = left_index;
      textarea.selectionEnd = right_index;
    }
  }

  // ========================================================================= //
  
  var commands = {};
  var tbbuttons = [];

  var outer_container = document.createElement("div");
  var toolbar_container = document.createElement("div");

  var statem = {
    "tbgroup": 0
  };

  outer_container.className = "cedit-root";
  toolbar_container.className = "cedit-toolbar";
  textarea.classList.add("cedit-textarea");

  textarea.parentElement.insertBefore(outer_container, textarea);
  outer_container.appendChild(toolbar_container);
  outer_container.appendChild(textarea);

  textarea.addEventListener("keydown", function(event) {
    Object.keys(commands).map(function(e) {
      return commands[e];
    }).forEach(function(command) {
      if (commands.keys === null)
        return;
      if (
        event.key.toLowerCase() === command.keys.key.toLowerCase() &&
        event.ctrlKey === command.keys.ctrl &&
        event.altKey === command.keys.alt &&
        event.shiftKey === command.keys.shift) {
        event.preventDefault();
        execute_command(command);
      }
    });

    ev_selection_change();
  });
  
  document.addEventListener("selectionchange", ev_selection_change);
  textarea.addEventListener("mousedown", ev_selection_change);
  textarea.addEventListener("mouseup", ev_selection_change);
  textarea.addEventListener("keyup", ev_selection_change);

  // ========================================================================= //

  this.textarea = textarea;
  this.gtokens = () => commands;

  // ========================================================================= //

  register_command_text("builtin/font/bold", "ctrl-b", "*", "*", "Toggle bold text");
  register_command_text("builtin/font/italic", "ctrl-i", "/", "/", "Toggle italic text");
  register_command_text("builtin/font/underline", "ctrl-u", "_", "_", "Toggle underlined text");
  register_command_text("builtin/font/color", "ctrl-shift-c", "{color:#000000 ", "}", "Change text color");
  register_command_text("builtin/font/monospace", "ctrl-r", "`", "`", "Toggle monospaced text");

  register_command_text("builtin/text/link", "ctrl-l", "{link:url ", "}", "Insert hyperlink");
  register_command_text("builtin/text/mention", "ctrl-m", "{user:|}", null, "Mention user", true);
  
  for (var i = 1; i <= 6; i++)
    register_command_text("builtin/text/header" + i, "ctrl-shift-" + "asdfgh".split("")[i-1], repeat_string("#", i) + " ", "", "Header " + i, true);

  register_command("builtin/action/submit", "ctrl-enter", "Submit form", submit_if_in_form);
  register_command("builtin/action/help", "ctrl-shift-j", "Show keyboard shortcuts", show_help);
  register_command("builtin/toolbar/expandcollapse", "ctrl-shift-alt-t", "Expand/collapse toolbar", function() { toolbar_container.classList.toggle("cedit-toolbar-collapsed"); });
  register_command("builtin/action/selectcurrent", "ctrl- ", "Select current token", select_current_token);

  // ---------------- //

  tb_begin_group();
  add_toolbar_button("B", "builtin/font/bold", "Toggle bold text").classList.add("cedit-toolbar-button_font-bold", "cedit-toolbar-button-fixed-width");
  add_toolbar_button("I", "builtin/font/italic", "Toggle italic text").classList.add("cedit-toolbar-button_font-italic", "cedit-toolbar-button-fixed-width");
  add_toolbar_button("U", "builtin/font/underline", "Toggle underlined text").classList.add("cedit-toolbar-button_font-underline", "cedit-toolbar-button-fixed-width");
  tb_end_group();
  add_toolbar_button("</>", "builtin/font/monospace", "Toggle monospaced text").classList.add("cedit-toolbar-button_font-monospace", "cedit-toolbar-button-fixed-width");
  add_toolbar_separator();
  tb_begin_group();
  add_toolbar_button("\uD83D\uDD17\uFE0E", "builtin/text/link", "Insert hyperlink").classList.add("cedit-toolbar-button_text-link", "cedit-toolbar-button-fixed-width");
  tb_end_group();
  add_toolbar_button("\uD83C\uDFA8\uFE0E", "builtin/font/color", "Change text color").classList.add("cedit-toolbar-button_font-color", "cedit-toolbar-button-fixed-width");
  add_toolbar_separator();
  add_toolbar_button("@", "builtin/text/mention", "Mention user").classList.add("cedit-toolbar-button_text-mention", "cedit-toolbar-button-fixed-width");
  add_toolbar_separator();
  add_toolbar_button("?", "builtin/action/help", "Show keyboard shortcuts").classList.add("cedit-toolbar-button_action-help", "cedit-toolbar-button-fixed-width");
  add_toolbar_separator();

  add_toolbar_button("", "builtin/toolbar/expandcollapse", "Expand/collapse toolbar").classList.add("cedit-toolbar-button_expand-collapse", "cedit-toolbar-button-fixed-width");
}
