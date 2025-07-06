String inputString = "";
bool stringComplete = false;

void setup() {
  Serial.begin(115200);
  inputString.reserve(200);

  pinMode(2, OUTPUT);
}

void loop() {
  if (stringComplete) {
    inputString.trim();
    if (inputString == "ON") {
      digitalWrite(2, HIGH);
    }
    else if (inputString == "OFF") {
      digitalWrite(2, LOW);
    }
    Serial.println(inputString);
    // clear the string:
    inputString = "";
    stringComplete = false;
  }
}

void serialEvent() {
  while (Serial.available()) {
    char inChar = (char)Serial.read();
    inputString += inChar;
    if (inChar == '\n') {
      stringComplete = true;
    }
  }
}
