
#include <iostream>
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <fcntl.h>
#include <termios.h>
#include <string.h>

using namespace std;

int main(int argc, char *argv[]) {
    // std::cout << "CREAD: " << (CREAD) << "\n";
    // std::cout << "CLOCAL:" << CLOCAL << "\n";
    // std::cout << "PARENB:" << PARENB << "\n";
    // std::cout << "CSTOPB:" << CSTOPB << "\n";
    // std::cout << "CSIZE:" << CSIZE << "\n";
    // std::cout << "CS8:" << CS8 << "\n";
    // std::cout << "CRTSCTS:" << CRTSCTS << "\n";
    // std::cout << "IXON:" << IXON << "\n";
    // std::cout << "IXOFF:" << IXOFF << "\n";
    // std::cout << "IXANY:" << IXANY << "\n";
    // std::cout << "ICANON:" << ICANON << "\n";
    // std::cout << "ECHO:" << ECHO << "\n";
    // std::cout << "ECHOE:" << ECHOE << "\n";
    // std::cout << "ISIG:" << ISIG << "\n";
    // std::cout << "VMIN:" << VMIN << "\n";
    // std::cout << "VTIME:" << VTIME << "\n";
    // std::cout << "TCSANOW:" << TCSANOW << "\n";
    // std::cout << "F_SETFL:" << F_SETFL << "\n";
    // std::cout << "O_RDWR = " << (O_RDWR) << "\n";
    // std::cout << "O_NOCTTY = " << (O_NOCTTY) << "\n";
    // std::cout << "O_NDELAY = " << (O_NDELAY) << "\n";
    
    // std::cout << "B4800 = " << (B4800) << "\n";
    // std::cout << "B9600 = " << (B9600) << "\n";
    // std::cout << "B14400 = " << (B14400) << "\n";
    // std::cout << "B19200 = " << (B19200) << "\n";
    // std::cout << "B28800 = " << (B28800) << "\n";
    // std::cout << "B38400 = " << (B38400) << "\n";
    // std::cout << "B57600 = " << (B57600) << "\n";
    // std::cout << "B115200 = " << (B115200) << "\n";
    std::cout << "OPOST = " << (OPOST) << "\n";
    // return 0;
    
    int fd;
    // char *portname = "/dev/tty.usbmodem1421";
    char *portname = "/dev/tty.usbmodem1101";
    char buf[256];
    int n;
    int i;
    int count = 0;
    int baudrate = 115200;
    struct termios toptions;
    
    fd = open(portname, O_RDWR | O_NOCTTY | O_NDELAY);
    if (fd == -1) {
        perror("serialport_init: Unable to open port ");
        return -1;
    }

    if (tcgetattr(fd, &toptions) < 0) {
        perror("serialport_init: Couldn't get term attributes");
        return -1;
    }
    speed_t brate = baudrate; // let you override switch below if needed
    switch(baudrate) {
        case 4800:   brate=B4800;   break;
        case 9600:   brate=B9600;   break;
        #if defined B14400
        case 14400:  brate=B14400;  break;
        #endif
        case 19200:  brate=B19200;  break;
        #if defined B28800
        case 28800:  brate=B28800;  break;
        #endif
        case 38400:  brate=B38400;  break;
        case 57600:  brate=B57600;  break;
        case 115200: brate=B115200; break;
    }
    cfsetispeed(&toptions, brate);
    cfsetospeed(&toptions, brate);

     // 8N1
    toptions.c_cflag &= ~PARENB; // parity enable = off
    toptions.c_cflag &= ~CSTOPB;
    toptions.c_cflag &= ~CSIZE;
    toptions.c_cflag |= CS8;
    // no flow control
    toptions.c_cflag &= ~CRTSCTS;

    toptions.c_cflag |= CREAD | CLOCAL;  // turn on READ & ignore ctrl lines
    toptions.c_iflag &= ~(IXON | IXOFF | IXANY); // turn off s/w flow ctrl

    toptions.c_lflag &= ~(ICANON | ECHO | ECHOE | ISIG); // make raw
    //     toptions.c
    // [...]

    // oflag &= ~OPOST; // make raw
    // std::cout << "sizeof(toptions.c_cc) = " << (sizeof(toptions.c_cc)) << "\n";
    // std::cout << "sizeof(VMIN) = " << (sizeof(VMIN)) << "\n";
    // std::cout << "sizeof(cc_t) = " << (sizeof(cc_t)) << "\n";
    toptions.c_cc[VMIN]  = 0;
    toptions.c_cc[VTIME] = 20;

    FILE *file = fopen("toptions.dat", "wb");
    if (file == NULL) {
        perror("Error opening file");
        return 1;
    }

    // Write the raw bytes of the struct to the file
    size_t struct_size = sizeof(toptions);
    size_t written = fwrite(&toptions, 1, struct_size, file);

    if (written != struct_size) {
        perror("Error writing to file");
        fclose(file);
        return 1;
    }

    printf("Struct written to file successfully\n");
    return 0;
    
    if( tcsetattr(fd, TCSANOW, &toptions) < 0) {
        perror("init_serialport: Couldn't set term attributes");
        return -1;
    }

    while (1) {
        n = read(fd, buf, 255);
        if (n > 0) {
            buf[n] = 0;
            printf("read %i bytes: %s", n, buf);
        }
        if (count == 0) {
            n = write(fd, "Hello!", 6);
            if (n < 0) {
                perror("Write failed");
            }
            count++;
        }
        usleep(100000);
    }

    return 0;
}