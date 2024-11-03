import cv2
import time

density = """$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft|()1{}[]?-_+~<>i!lI;:,"^`'."""

density2 = 'N@#W$9876543210?!abc;:+=-,._ '
def gbr_to_hex(rgb_array):
    b, g, r = rgb_array
    hex_color = '#{:02x}{:02x}{:02x}'.format(r, g, b)
    return hex_color


def html_setup(font, size):
    with open("index.html", "w") as file:
        file.write("<!DOCTYPE html><html><head>")
        file.write("<meta charset='UTF-8'>")
        file.write("<style>")
        file.write("body { background-color: black; margin: 0; padding: 0; }")
        file.write("p.small { line-height: 0.8; margin: 0; padding: 0; }")
        file.write("</style>")
        file.write("</head><body>")
        file.write(f"<p style='font-family: {font}; font-size: {size}px;' class='small'>")

def html_close():
    with open("index.html", "a") as file:
        file.write("</p></body></html>")
    print("HTML file successfully written.")


def color_ascii(img, scale):
    start = time.perf_counter()
    image = cv2.imread(img)
    resize = cv2.resize(image, (0, 0), fx=scale, fy=scale)
    gray = cv2.cvtColor(resize, cv2.COLOR_BGR2GRAY)

    html_setup("Courier New", 10)

    with open("index.html", "a") as file:
        for i in range(resize.shape[0]):
            for j in range(resize.shape[1]):
                value = gray[i, j]
                color = resize[i, j]
                hex_color = gbr_to_hex(color)
                char = density[value // 68]
                file.write(f"<span style='color: {hex_color};'>{char}</span>")
            file.write("<br>")

    html_close()
    end = time.perf_counter()
    print("Time elapsed:{0}".format(end - start))

color_ascii("pavan.jpg", 0.1)


