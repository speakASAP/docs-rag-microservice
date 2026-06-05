# Pay Key Utils installation guide

## Java 8

1. Download Java 8 SE from 
        
        https://www.oracle.com/technetwork/java/javase/downloads/jre8-downloads-2133155.html

2. Install to directory e.g.:

        "C:\Program Files\Java\jre1.8.0_221"
        
3. Run pay-keyutils.jar:

        "C:\Program Files\Java\jre1.8.0_221\bin\java.exe" -jar pay-keyutils.jar

## Java 11

1. Download Java 11 from

        https://www.oracle.com/technetwork/java/javase/downloads/jdk11-downloads-5066655.html

3. Install to directory e.g.:

        "C:\Program Files\Java\jdk-11.0.5"
    
4. Download JavaFX 11 

        https://gluonhq.com/products/javafx
        
5. Install to directory e.g.: 
        
        "C:\Program Files\Java\javafx-sdk-11.0.2"

6. Run pay-keyutils.jar:

        "C:\Program Files\Java\jdk-11.0.5\bin\java.exe" --module-path "C:\Program Files\Java\javafx-sdk-11.0.2\lib" --add-modules=javafx.controls,javafx.fxml -jar pay-keyutils.jar
